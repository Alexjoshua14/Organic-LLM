import type { SubagentHeartbeatDeps, SubagentHeartbeatOutcome } from "./run-heartbeat";

import { randomUUID } from "crypto";

import { readGatewayBilledCostUsd } from "@/lib/usage/gateway-attribution";

export type HeartbeatStage =
  | "budget"
  | "target"
  | "list-children"
  | "load-state"
  | "load-messages"
  | "claim"
  | "evaluate"
  | "record-usage"
  | "append-message"
  | "enqueue-reply"
  | "complete"
  | "finished";

export type HeartbeatRunTelemetry = {
  id: string;
  owner_id: string;
  thread_id: string;
  started_at: string;
  duration_ms: number;
  status: SubagentHeartbeatOutcome["status"] | "blocked-budget" | "invalid-target";
  stage: HeartbeatStage;
  subagent_count: number | null;
  evaluation_attempted: boolean;
  evaluation_duration_ms: number | null;
  event_count: number;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  generation_id: string | null;
  provider: string | null;
  error_code: "timeout" | "operation-failed" | null;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function identifier(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_.:/-]{1,200}$/.test(value) ? value : null;
}

function tokens(value: number | undefined): number | null {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Metadata only: never retain prompts, snapshots, messages, or exception text. */
export function createHeartbeatTelemetry(args: {
  ownerId: string;
  threadId: string;
  clock?: () => number;
}) {
  const clock = args.clock ?? (() => performance.now());
  const start = clock();
  const row: HeartbeatRunTelemetry = {
    id: randomUUID(),
    owner_id: args.ownerId,
    thread_id: args.threadId,
    started_at: new Date().toISOString(),
    duration_ms: 0,
    status: "error",
    stage: "budget",
    subagent_count: null,
    evaluation_attempted: false,
    evaluation_duration_ms: null,
    event_count: 0,
    model_id: null,
    input_tokens: null,
    output_tokens: null,
    total_tokens: null,
    cost_usd: null,
    generation_id: null,
    provider: null,
    error_code: null,
  };

  async function measure<T>(stage: HeartbeatStage, operation: () => Promise<T>): Promise<T> {
    row.stage = stage;
    try {
      return await operation();
    } catch (error) {
      row.error_code =
        error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
          ? "timeout"
          : "operation-failed";
      throw error;
    }
  }

  return {
    measure,
    instrument(
      deps: SubagentHeartbeatDeps & { evaluate: NonNullable<SubagentHeartbeatDeps["evaluate"]> }
    ): SubagentHeartbeatDeps {
      return {
        ...deps,
        listChildren: () =>
          measure("list-children", async () => {
            const children = await deps.listChildren();

            row.subagent_count = children.length;

            return children;
          }),
        getState: () => measure("load-state", deps.getState),
        loadMessages: (...params) => measure("load-messages", () => deps.loadMessages(...params)),
        claim: (params) => measure("claim", () => deps.claim(params)),
        complete: (params) => measure("complete", () => deps.complete(params)),
        appendSystemMessage: (message) =>
          measure("append-message", () => deps.appendSystemMessage(message)),
        enqueueReply: (message) => measure("enqueue-reply", () => deps.enqueueReply(message)),
        recordUsage: (params) =>
          measure("record-usage", async () => {
            await deps.recordUsage(params);
          }),
        evaluate: (params) =>
          measure("evaluate", async () => {
            row.evaluation_attempted = true;
            const evaluationStart = clock();

            try {
              const result = await deps.evaluate(params);

              row.event_count = result.decision.events.length;
              row.model_id = result.modelId;
              row.input_tokens = tokens(result.usage?.inputTokens);
              row.output_tokens = tokens(result.usage?.outputTokens);
              row.total_tokens = tokens(result.usage?.totalTokens);
              row.cost_usd = readGatewayBilledCostUsd(result.providerMetadata) ?? null;
              const gateway = record(record(result.providerMetadata).gateway);

              row.generation_id = identifier(gateway.generationId);
              row.provider = identifier(record(gateway.routing).finalProvider);

              return result;
            } finally {
              row.evaluation_duration_ms = Math.max(0, Math.round(clock() - evaluationStart));
            }
          }),
      };
    },
    finish(status: HeartbeatRunTelemetry["status"]): HeartbeatRunTelemetry {
      row.status = status;
      row.duration_ms = Math.max(0, Math.round(clock() - start));
      if (status === "error") row.error_code ??= "operation-failed";
      else if (status !== "blocked-budget" && status !== "invalid-target") row.stage = "finished";

      return { ...row };
    },
  };
}
