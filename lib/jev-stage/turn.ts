import "server-only";

import {
  JEV_STAGE_MAX_TURN_INSIGHTS,
  JEV_STAGE_REPLY_CHAR_CAP,
  JEV_STAGE_TURN_MAX_STEPS,
  JEV_GATEWAY_TRACE_MODEL,
} from "./constants";
import { executeJevDirectTool, isDirectJevAction } from "./direct-tools";
import { streamJevOrchestrate } from "./orchestrate";
import { applyJevRespondEffects, streamJevRespond } from "./respond";
import { routeJevStage } from "./router";
import type {
  JevStageBundle,
  JevStageCandidate,
  JevStageStreamEvent,
  JevStageTurnInsight,
} from "./schema";
import {
  acquireJevStageLease,
  hasJevStageRequest,
  markJevStageRequest,
  readJevStage,
  releaseJevStageLease,
  writeJevStage,
} from "./store";
import { finishModelCall, startCallClock, withCallSummary } from "./trace";
import { invalidSelectedActionReason, settingsBlockReason } from "./validate-action";

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
        text:
          args.reply.length > JEV_STAGE_REPLY_CHAR_CAP
            ? `${args.reply.slice(0, JEV_STAGE_REPLY_CHAR_CAP)}\n\n(Reply truncated at ${JEV_STAGE_REPLY_CHAR_CAP.toLocaleString()} characters.)`
            : args.reply || "…",
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

function respondCandidate(reason: string): JevStageCandidate {
  return { kind: "respond", confidence: 1, reason, args: {} };
}

/** True when this request already has a non-empty assistant line in Conversation. */
function turnHasVisibleReply(state: StageState, requestId: string): boolean {
  const userIndex = state.messages.findIndex((entry) => entry.id === requestId);

  if (userIndex < 0) return false;

  return state.messages
    .slice(userIndex + 1)
    .some((entry) => entry.role === "assistant" && entry.text.trim().length > 0);
}

async function emitDuplicateDone(
  ownerId: string,
  requestId: string,
  emit: (event: JevStageStreamEvent) => void
) {
  const bundle = await readJevStage(ownerId);
  const insight =
    bundle.insights.find((item) => item.turnId === requestId) ??
    bundle.insights.at(-1) ??
    null;

  if (insight) {
    emit({ type: "done", insight, stage: bundle.stage });
  } else {
    emit({ type: "error", message: "Duplicate request with no stored turn." });
  }

  return bundle;
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
    return emitDuplicateDone(args.ownerId, args.requestId, args.emit);
  }

  const lease = await acquireJevStageLease(args.ownerId);

  if (!lease) {
    throw new JevStageTurnError("Another turn is already running on this prototype stage.", 409);
  }

  try {
    if (await hasJevStageRequest(args.ownerId, args.requestId)) {
      return emitDuplicateDone(args.ownerId, args.requestId, args.emit);
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
      stage: bundle.stage,
    });

    let selected = routed.selected;
    let fellBack = routed.fellBack || routed.source === "fallback";
    let fallbackReason =
      routed.fallbackReason ?? (routed.source === "fallback" ? "Jev call failed" : null);

    const blocked =
      invalidSelectedActionReason(selected) ??
      settingsBlockReason(selected.kind, args.settings);

    if (blocked) {
      selected = respondCandidate(blocked);
      fellBack = true;
      fallbackReason = blocked;
    }

    args.emit({
      type: "route",
      turnId,
      selected,
      candidates: routed.ranked,
      fellBack,
      fallbackReason,
      routerMs: routed.routerMs,
    });

    let stage = bundle.stage;
    const routerClock = startCallClock();
    const calls = [
      finishModelCall({
        id: crypto.randomUUID(),
        operation: "jev.route",
        model: JEV_GATEWAY_TRACE_MODEL,
        inputTokens: routed.usage.inputTokens,
        outputTokens: routed.usage.outputTokens,
        clock: { ...routerClock, firstTokenAt: routerClock.started + routed.routerMs },
      }),
    ];
    // Align latency with the measured router hop; cost is Gateway-reported or input-only.
    calls[0]!.latencyMs = routed.routerMs;
    calls[0]!.costUsd = routed.costUsd;
    let outcome: JevStageTurnInsight["outcome"] = "ok";
    let outcomeDetail: string | null = null;
    let action = selected;
    let steps = 0;

    // Bounded execution loop: direct tool → optional Respond fallback → safety net.
    while (steps < JEV_STAGE_TURN_MAX_STEPS) {
      steps += 1;

      if (isDirectJevAction(action.kind)) {
        const result = await executeJevDirectTool({
          ownerId: args.ownerId,
          state: stage,
          selected: action,
          message: args.message,
          requestId: args.requestId,
          settings: args.settings,
        });

        stage = result.state;
        if (result.note) {
          args.emit({ type: "delta", text: result.note });
          const alreadyLogged = stage.messages.some((entry) => entry.id === args.requestId);

          if (!alreadyLogged) {
            stage = {
              ...stage,
              revision: stage.revision + 1,
              messages: [
                ...stage.messages,
                { id: args.requestId, role: "user" as const, text: args.message },
                {
                  id: crypto.randomUUID(),
                  role: "assistant" as const,
                  text: result.note.slice(0, JEV_STAGE_REPLY_CHAR_CAP),
                },
              ].slice(-24),
            };
          }
        }
        args.emit({ type: "patch", stage });

        if (turnHasVisibleReply(stage, args.requestId)) break;

        const reason = "Direct tool left no user-visible reply; falling back to Respond";
        action = respondCandidate(reason);
        selected = action;
        fellBack = true;
        fallbackReason = reason;
        continue;
      }

      if (action.kind === "orchestrate") {
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
        const reply = (streamed.text || draft).trim();

        if (!reply) {
          const reason = "Orchestrate returned no text; falling back to Respond";
          action = respondCandidate(reason);
          selected = action;
          fellBack = true;
          fallbackReason = reason;
          continue;
        }

        stage = applyStreamedReply({
          state: stage,
          message: args.message,
          requestId: args.requestId,
          reply,
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
        break;
      }

      // Respond (selected or fallback)
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

      const reply =
        (streamed.text || draft).trim() ||
        (streamed.limitError
          ? streamed.limitError.message
          : "I heard you — give me another beat and I’ll try again.");

      stage = applyStreamedReply({
        state: stage,
        message: args.message,
        requestId: args.requestId,
        reply,
        summary: streamed.summary,
        designBrief: streamed.designBrief,
        model: streamed.model,
      });
      // View, captures, recall, specialists and tier land the same way direct tools patch state.
      const applied = applyJevRespondEffects({
        state: stage,
        effects: streamed.effects,
        requestId: args.requestId,
        settings: args.settings,
      });

      stage = applied.state;
      if (applied.note) {
        const note = `\n\n${applied.note}`;

        args.emit({ type: "delta", text: note });
        stage = {
          ...stage,
          messages: stage.messages.map((entry, index) =>
            index === stage.messages.length - 1 && entry.role === "assistant"
              ? { ...entry, text: `${entry.text}${note}`.slice(0, JEV_STAGE_REPLY_CHAR_CAP) }
              : entry
          ),
        };
      }
      args.emit({ type: "patch", stage });
      break;
    }

    // Final safety: never leave the user with a completed turn and no Conversation line.
    if (!turnHasVisibleReply(stage, args.requestId)) {
      const safety = "I got your message, but nothing rendered. Please try once more.";
      args.emit({ type: "delta", text: safety });
      stage = applyStreamedReply({
        state: stage,
        message: args.message,
        requestId: args.requestId,
        reply: safety,
        summary: null,
        designBrief: null,
        model: stage.lastModel,
      });
      fellBack = true;
      fallbackReason = fallbackReason ?? "Safety reply after empty turn steps";
      args.emit({ type: "patch", stage });
    }

    const insight = withCallSummary({
      turnId,
      at: new Date().toISOString(),
      userMessage: args.message,
      selected,
      candidates: routed.ranked,
      fellBack,
      fallbackReason,
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
