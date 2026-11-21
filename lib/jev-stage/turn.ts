import "server-only";

import { JEV_STAGE_MAX_TURN_INSIGHTS } from "./constants";
import { executeJevDirectTool, isDirectJevAction } from "./direct-tools";
import { streamJevOrchestrate } from "./orchestrate";
import { streamJevRespond } from "./respond";
import { routeJevStage } from "./router";
import type { JevStageBundle, JevStageStreamEvent, JevStageTurnInsight } from "./schema";
import {
  acquireJevStageLease,
  hasJevStageRequest,
  markJevStageRequest,
  readJevStage,
  releaseJevStageLease,
  writeJevStage,
} from "./store";
import { withCallSummary } from "./trace";

import { stageKnowledgeContext } from "@/lib/stage/knowledge";
import { assignStageSubagents } from "@/lib/stage/subagent-state";
import { placeStageArtifacts } from "@/lib/stage/artifacts";
import { StageLayoutError } from "@/lib/stage/layout";
import type { StageState, StageTurnSettings } from "@/lib/stage/schema";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export class JevStageTurnError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function applyStreamedReply(args: {
  state: StageState;
  message: string;
  requestId: string;
  reply: string;
  summary: string | null;
  designBrief: string | null;
  model: string;
}): StageState {
  const job = args.designBrief
    ? { id: crypto.randomUUID(), brief: args.designBrief }
    : null;
  let next: StageState = {
    ...args.state,
    revision: args.state.revision + 1,
    messages: [
      ...args.state.messages,
      { id: args.requestId, role: "user" as const, text: args.message },
      {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: args.reply.slice(0, 8000) || "…",
      },
    ].slice(-24),
    summary: args.summary ?? args.state.summary,
    lastModel: args.model,
    design: job && !args.state.design
      ? {
          ...job,
          status: "working" as const,
          phase: "queued" as const,
          startedAt: new Date().toISOString(),
        }
      : args.state.design,
    pendingDesigns:
      job && args.state.design ? [...args.state.pendingDesigns, job] : args.state.pendingDesigns,
  };

  if (args.reply.length > 320 && !job) {
    next = placeStageArtifacts(next, args.reply.slice(0, 1800), "Organic");
  }

  return next;
}

/**
 * Run one Jev-routed Stage turn, emitting stream events for the prototype client.
 * Jev is only the switch; execution is direct tools or LLM stream paths.
 */
export async function runJevStageTurn(args: {
  ownerId: string;
  clerkUserId: string;
  message: string;
  requestId: string;
  settings?: StageTurnSettings;
  emit: (event: JevStageStreamEvent) => void;
}): Promise<JevStageBundle> {
  if (await hasJevStageRequest(args.ownerId, args.requestId)) {
    return readJevStage(args.ownerId);
  }

  const lease = await acquireJevStageLease(args.ownerId);

  if (!lease) {
    throw new JevStageTurnError("Another turn is already running on this prototype stage.", 409);
  }

  try {
    if (await hasJevStageRequest(args.ownerId, args.requestId)) {
      return readJevStage(args.ownerId);
    }
    const gate = await requirePlanBudget({
      clerkUserId: args.clerkUserId,
      sbUserId: args.ownerId,
    });

    if (gate) throw new JevStageTurnError("Your plan budget is exhausted.", gate.status);
    const limited = await checkLlmMessageLimit(args.ownerId);

    if (!limited.success) {
      throw new JevStageTurnError(limited.error ?? "Too many messages", 429);
    }

    const bundle = await readJevStage(args.ownerId);
    const turnId = args.requestId;
    const routed = await routeJevStage({
      message: args.message,
      summary: bundle.stage.summary,
      knowledgeHint: JSON.stringify(stageKnowledgeContext(bundle.stage)),
    });

    args.emit({
      type: "route",
      turnId,
      selected: routed.selected,
      candidates: routed.ranked,
      fellBack: routed.fellBack || routed.source === "fallback",
      fallbackReason:
        routed.fallbackReason ??
        (routed.source === "fallback" ? "Jev call failed" : null),
      routerMs: routed.routerMs,
    });

    let stage = bundle.stage;
    const calls = [];
    let outcome: JevStageTurnInsight["outcome"] = "ok";
    let outcomeDetail: string | null = null;

    if (isDirectJevAction(routed.selected.kind)) {
      const result = await executeJevDirectTool({
        ownerId: args.ownerId,
        state: stage,
        selected: routed.selected,
        message: args.message,
        requestId: args.requestId,
        settings: args.settings,
      });

      stage = result.state;
      args.emit({ type: "patch", stage });
      if (result.note) args.emit({ type: "delta", text: result.note });
    } else if (routed.selected.kind === "orchestrate") {
      let draft = "";
      const streamed = await streamJevOrchestrate({
        ownerId: args.ownerId,
        clerkUserId: args.clerkUserId,
        state: stage,
        message: args.message,
        settings: args.settings,
        onDelta: (text) => {
          draft += text;
          args.emit({ type: "delta", text });
        },
      });

      calls.push(streamed.call);
      stage = applyStreamedReply({
        state: stage,
        message: args.message,
        requestId: args.requestId,
        reply: streamed.text || draft,
        summary: streamed.summary,
        designBrief: streamed.designBrief,
        model: streamed.model,
      });
      if (streamed.specialists.length) {
        try {
          stage = assignStageSubagents(stage, streamed.specialists, args.settings);
        } catch (error) {
          if (!(error instanceof StageLayoutError)) throw error;
          outcomeDetail = "Specialists needed more room on the stage.";
        }
      }
      args.emit({ type: "patch", stage });
    } else {
      let draft = "";
      const streamed = await streamJevRespond({
        ownerId: args.ownerId,
        clerkUserId: args.clerkUserId,
        state: stage,
        message: args.message,
        settings: args.settings,
        onDelta: (text) => {
          draft += text;
          args.emit({ type: "delta", text });
        },
      });

      calls.push(streamed.call);
      if (streamed.limitError) {
        outcome = "limit_error";
        outcomeDetail = streamed.limitError.message;
        args.emit({ type: "limit_error", message: streamed.limitError.message });
      }
      stage = applyStreamedReply({
        state: stage,
        message: args.message,
        requestId: args.requestId,
        reply: streamed.text || draft,
        summary: streamed.summary,
        designBrief: streamed.designBrief,
        model: streamed.model,
      });
      args.emit({ type: "patch", stage });
    }

    const insight = withCallSummary({
      turnId,
      at: new Date().toISOString(),
      userMessage: args.message,
      selected: routed.selected,
      candidates: routed.ranked,
      fellBack: routed.fellBack || routed.source === "fallback",
      fallbackReason:
        routed.fallbackReason ??
        (routed.source === "fallback" ? "Jev call failed" : null),
      routerMs: routed.routerMs,
      outcome,
      outcomeDetail,
      calls,
      eval: { signal: null, note: null },
    });

    const next: JevStageBundle = {
      stage,
      insights: [...bundle.insights, insight].slice(-JEV_STAGE_MAX_TURN_INSIGHTS),
    };

    await writeJevStage(args.ownerId, next);
    await markJevStageRequest(args.ownerId, args.requestId);
    args.emit({ type: "done", insight, stage });

    return next;
  } finally {
    await releaseJevStageLease(args.ownerId, lease);
  }
}

export async function resetJevStage(ownerId: string): Promise<JevStageBundle> {
  const { emptyJevStageBundle } = await import("./schema");
  const next = emptyJevStageBundle();

  await writeJevStage(ownerId, next);

  return next;
}

export async function setJevStageTurnEval(args: {
  ownerId: string;
  turnId: string;
  signal: "up" | "down";
  note?: string | null;
}): Promise<JevStageBundle> {
  const bundle = await readJevStage(args.ownerId);
  const insights = bundle.insights.map((insight) =>
    insight.turnId === args.turnId
      ? {
          ...insight,
          eval: {
            signal: args.signal,
            note: args.note?.trim() ? args.note.trim().slice(0, 500) : null,
          },
        }
      : insight
  );

  const next = { ...bundle, insights };

  await writeJevStage(args.ownerId, next);

  return next;
}
