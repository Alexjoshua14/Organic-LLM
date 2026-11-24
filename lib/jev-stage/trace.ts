import type { JevStageModelCallTrace, JevStageTurnInsight } from "./schema";

import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";

export function startCallClock() {
  return { started: performance.now(), firstTokenAt: null as number | null };
}

export function markFirstToken(clock: { firstTokenAt: number | null }) {
  if (clock.firstTokenAt == null) clock.firstTokenAt = performance.now();
}

export function finishModelCall(args: {
  id: string;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheByProvider?: JevStageModelCallTrace["cacheByProvider"];
  clock: { started: number; firstTokenAt: number | null };
}): JevStageModelCallTrace {
  const latencyMs = Math.round(performance.now() - args.clock.started);
  const timeToFirstTokenMs =
    args.clock.firstTokenAt == null ? null : Math.round(args.clock.firstTokenAt - args.clock.started);
  const costUsd = computeUsageCostUsd(args.model, {
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    cachedInputTokens: args.cachedInputTokens ?? 0,
  });
  const tokensPerSecond =
    latencyMs > 0 ? Math.round((args.outputTokens / latencyMs) * 1000 * 10) / 10 : null;

  return {
    id: args.id,
    operation: args.operation,
    model: args.model,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    cachedInputTokens: args.cachedInputTokens ?? 0,
    costUsd,
    latencyMs,
    timeToFirstTokenMs,
    cacheReported: args.cachedInputTokens != null,
    cacheByProvider: args.cacheByProvider,
    tokensPerSecond,
  };
}

/** A superseded draft should not be committed as part of the corrected answer. */
export function replyAfterLastCorrection(
  text: string,
  steps: readonly { text: string; experimental_steeringMessages?: readonly unknown[] }[]
) {
  const lastCorrection = steps.findLastIndex((step) => step.experimental_steeringMessages?.length);

  return lastCorrection < 0 ? text : steps.slice(lastCorrection).map((step) => step.text).join("");
}

export type JevCacheStep = {
  response: { modelId?: string };
  providerMetadata?: { gateway?: Record<string, unknown> };
  usage: { inputTokenDetails?: { cacheReadTokens?: number } };
};

/** Gateway fallback may change providers between steps. Keep the reported counts attributed. */
export function cacheByProvider(model: string, steps: readonly JevCacheStep[]) {
  const totals = new Map<string, { provider: string | null; model: string; cachedInputTokens: number | null }>();

  for (const step of steps) {
    const routing = step.providerMetadata?.gateway?.routing;
    const reported = routing && typeof routing === "object" && "finalProvider" in routing
      ? routing.finalProvider
      : null;
    const provider = typeof reported === "string" ? reported : null;
    const servedModel = step.response.modelId || model;
    const tokens = step.usage.inputTokenDetails?.cacheReadTokens;
    const key = JSON.stringify([provider, servedModel, tokens == null]);
    const previous = totals.get(key)?.cachedInputTokens ?? 0;

    totals.set(key, { provider, model: servedModel, cachedInputTokens: tokens == null ? null : previous + tokens });
  }

  return [...totals.values()];
}

export function summarizeCalls(calls: ReadonlyArray<JevStageModelCallTrace>) {
  const perModelSpendUsd: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let costUsd = 0;
  let latencyMs = 0;

  for (const call of calls) {
    inputTokens += call.inputTokens;
    outputTokens += call.outputTokens;
    cachedInputTokens += call.cachedInputTokens;
    costUsd += call.costUsd;
    latencyMs += call.latencyMs;
    perModelSpendUsd[call.model] = (perModelSpendUsd[call.model] ?? 0) + call.costUsd;
  }

  return {
    totals: { inputTokens, outputTokens, cachedInputTokens, costUsd, latencyMs },
    perModelSpendUsd,
  };
}

export function withCallSummary(
  insight: Omit<JevStageTurnInsight, "totals" | "perModelSpendUsd"> & {
    totals?: JevStageTurnInsight["totals"];
    perModelSpendUsd?: JevStageTurnInsight["perModelSpendUsd"];
  }
): JevStageTurnInsight {
  const { totals, perModelSpendUsd } = summarizeCalls(insight.calls);

  return { ...insight, totals, perModelSpendUsd };
}
