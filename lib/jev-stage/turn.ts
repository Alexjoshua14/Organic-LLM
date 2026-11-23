import "server-only";

import {
  JEV_STAGE_CONFIDENCE_FLOOR,
  JEV_STAGE_MAX_TURN_INSIGHTS,
  JEV_STAGE_REPLY_CHAR_CAP,
  JEV_STAGE_TURN_MAX_STEPS,
  JEV_STAGE_TURN_DEADLINE_MS,
  JEV_GATEWAY_TRACE_MODEL,
} from "./constants";
import { jevContextManifest } from "./context-manifest";
import { executeJevDirectTool, isDirectJevAction } from "./direct-tools";
import { streamJevOrchestrate } from "./orchestrate";
import { applyJevRespondEffects, streamJevRespond } from "./respond";
import { routeJevStage } from "./router";
import type {
  JevStageBundle,
  JevStageCandidate,
  JevStageCorrection,
  JevStageStepBoundary,
  JevStageStreamEvent,
  JevStageTurnInsight,
} from "./schema";
import {
  activeJevStageRequests,
  beginJevStageRequest,
  endJevStageRequest,
  finishJevStageRequest,
  hasJevStageRequest,
  mutateJevStage,
  readJevStage,
  releaseJevStageLease,
  waitForJevStageLease,
} from "./store";
import { mergeJevStageTurn } from "./merge-turn";
import { jevStageWorkers, submitJevCorrection, withJevStageSteering } from "./steering";
import { finishModelCall, startCallClock, withCallSummary } from "./trace";
import {
  actionVia,
  createJevTraceRecorder,
  hopListener,
  jevDecisionEvent,
  jevStepBoundaryListener,
  summarizeTraceValue,
} from "./trace-events";
import { invalidSelectedActionReason, settingsBlockReason } from "./validate-action";

import { stageKnowledgeContext } from "@/lib/stage/knowledge";
import { assignStageSubagents } from "@/lib/stage/subagent-state";
import { placeStageArtifacts } from "@/lib/stage/artifacts";
import { StageLayoutError } from "@/lib/stage/layout";
import type { StageState, StageTurnSettings } from "@/lib/stage/schema";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

const CORRECTION_SAVE_WINDOW_MS = 15_000;

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
    ? { id: args.requestId, brief: args.designBrief }
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
    bundle.insights.find((item) => item.turnId === requestId);

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
  /** Observe each completed step without blocking or changing turn execution. */
  onStepBoundary?: (boundary: JevStageStepBoundary) => void | Promise<void>;
}): Promise<JevStageBundle> {
  if (await hasJevStageRequest(args.ownerId, args.requestId)) {
    return emitDuplicateDone(args.ownerId, args.requestId, args.emit);
  }

  const signal = AbortSignal.timeout(JEV_STAGE_TURN_DEADLINE_MS);
  const gate = await requirePlanBudget({
    clerkUserId: args.clerkUserId,
    sbUserId: args.ownerId,
  });

  if (gate) throw new JevStageTurnError("Your plan budget is exhausted.", gate.status);
  const limited = await checkLlmMessageLimit(args.ownerId);

  if (!limited.success) {
    throw new JevStageTurnError(limited.error ?? "Too many messages", 429);
  }

  const admission = await waitForJevStageLease(args.ownerId, signal);
  let admittedUntil: number;

  try {
    if (await hasJevStageRequest(args.ownerId, args.requestId)) {
      return emitDuplicateDone(args.ownerId, args.requestId, args.emit);
    }
    admittedUntil = await beginJevStageRequest(args.ownerId, args.requestId, admission);
    if (!admittedUntil) {
      throw new JevStageTurnError(
        "This message is already running or Stage has four active requests.",
        409
      );
    }
  } finally {
    await releaseJevStageLease(args.ownerId, admission);
  }

  try {
    args.emit({ type: "accepted" });
    const [bundle, workers] = await Promise.all([
      readJevStage(args.ownerId),
      jevStageWorkers(args.ownerId),
    ]);
    const turnId = args.requestId;
    const onStepBoundary = jevStepBoundaryListener(turnId, args.onStepBoundary);
    // Live pipeline trace (COA-755): streamed as it happens, stored on the insight.
    const trace = createJevTraceRecorder((event) => {
      args.emit({ type: "trace", turnId, event });
      onStepBoundary(event);
    });

    trace.record({ kind: "jev.start", t: trace.t() });
    const routed = await routeJevStage({
      message: args.message,
      summary: bundle.stage.summary,
      knowledgeHint: JSON.stringify(stageKnowledgeContext(bundle.stage)),
      stage: bundle.stage,
      activeWorkers: workers,
    });
    const decision = jevDecisionEvent(trace.t(), routed, JEV_STAGE_CONFIDENCE_FLOOR);

    trace.record({
      kind: "hop.context",
      t: trace.t(),
      hopId: "jev",
      model: JEV_GATEWAY_TRACE_MODEL,
      manifest: jevContextManifest(routed.request),
    });
    trace.record(decision);

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
    trace.record({
      kind: "action",
      t: trace.t(),
      action: selected.kind,
      via: actionVia({
        source: routed.source,
        belowFloor: decision.belowFloor,
        blocked: !!blocked,
      }),
      reason: selected.reason,
    });

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
    let correction: JevStageCorrection | undefined;
    const target = workers.find((worker) => worker.turnId === routed.correctionTarget);

    if (target) {
      correction = await submitJevCorrection({
        ownerId: args.ownerId,
        target,
        id: turnId,
        text: args.message,
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(JEV_STAGE_TURN_DEADLINE_MS - CORRECTION_SAVE_WINDOW_MS),
        ]),
        onQueued: (receipt) => args.emit({ type: "correction", correction: receipt }),
      });
      args.emit({ type: "correction", correction });
      stage = {
        ...stage,
        messages: [
          ...stage.messages,
          { id: turnId, role: "user" as const, text: args.message },
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: correction.status === "delivered"
              ? "Correction delivered to the active worker."
              : correction.status === "unconfirmed"
                ? "I couldn’t confirm whether the worker received your correction."
                : "Correction wasn’t delivered. You can send it again as a new request.",
          },
        ].slice(-24),
      };
    }

    // Bounded execution loop: direct tool → optional Respond fallback → safety net.
    while (!correction && steps < JEV_STAGE_TURN_MAX_STEPS) {
      signal.throwIfAborted();
      steps += 1;

      if (isDirectJevAction(action.kind)) {
        const hopId = crypto.randomUUID();
        const hopStarted = trace.t();

        trace.record({
          kind: "hop.start",
          t: hopStarted,
          hopId,
          operation: "direct",
          action: action.kind,
          model: null,
        });
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
        const visible = turnHasVisibleReply(stage, args.requestId);
        const hopEnded = trace.t();

        trace.record({
          kind: "hop.end",
          t: hopEnded,
          hopId,
          ms: hopEnded - hopStarted,
          ok: visible,
          call: null,
          note: result.note ? summarizeTraceValue(result.note) : null,
        });

        if (visible) break;

        const reason = "Direct tool left no user-visible reply; falling back to Respond";
        trace.record({ kind: "fallback", t: trace.t(), from: action.kind, to: "respond", reason });
        action = respondCandidate(reason);
        selected = action;
        fellBack = true;
        fallbackReason = reason;
        continue;
      }

      if (action.kind === "orchestrate") {
        const hopId = crypto.randomUUID();
        const streamed = await withJevStageSteering(args.ownerId, turnId, args.message, (steering) =>
          streamJevOrchestrate({
            steering,
            ownerId: args.ownerId,
            clerkUserId: args.clerkUserId,
            state: stage,
            message: args.message,
            settings: args.settings,
            signal,
            onDelta: (text) => args.emit({ type: "delta", text }),
            onHop: hopListener(trace, hopId, action.kind, "orchestrate"),
          })
        );

        calls.push(streamed.call);
        const reply = streamed.text.trim();

        trace.record({
          kind: "hop.end",
          t: trace.t(),
          hopId,
          ms: streamed.call.latencyMs,
          ok: !!reply,
          call: streamed.call,
          note: streamed.specialists.length
            ? `Dispatched ${streamed.specialists.map((agent) => agent.name).join(", ")}`
            : null,
        });

        if (!reply) {
          const reason = "Orchestrate returned no text; falling back to Respond";
          trace.record({ kind: "fallback", t: trace.t(), from: "orchestrate", to: "respond", reason });
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
        break;
      }

      // Respond (selected or fallback)
      const hopId = crypto.randomUUID();
      const streamed = await withJevStageSteering(args.ownerId, turnId, args.message, (steering) =>
        streamJevRespond({
          steering,
          ownerId: args.ownerId,
          clerkUserId: args.clerkUserId,
          state: stage,
          message: args.message,
          settings: args.settings,
          signal,
          onDelta: (text) => args.emit({ type: "delta", text }),
          onHop: hopListener(trace, hopId, action.kind, "respond"),
        })
      );

      calls.push(streamed.call);
      trace.record({
        kind: "hop.end",
        t: trace.t(),
        hopId,
        ms: streamed.call.latencyMs,
        ok: !streamed.limitError,
        call: streamed.call,
        note: streamed.limitError ? streamed.limitError.message : null,
      });
      if (streamed.limitError) {
        outcome = "limit_error";
        outcomeDetail = streamed.limitError.message;
        args.emit({ type: "limit_error", message: streamed.limitError.message });
      }

      const reply =
        streamed.text.trim() ||
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
        model: stage.lastModel ?? "safety",
      });
      fellBack = true;
      fallbackReason = fallbackReason ?? "Safety reply after empty turn steps";
      trace.record({
        kind: "fallback",
        t: trace.t(),
        from: action.kind,
        to: "safety",
        reason: "Nothing visible after the turn steps; wrote a safety reply",
      });
    }

    const saveLease = await waitForJevStageLease(args.ownerId, signal);
    try {
      const current = await readJevStage(args.ownerId);
      const merged = mergeJevStageTurn(bundle.stage, stage, current.stage);

      if (merged.conflict) {
        if (!correction) {
          merged.state.messages.push({
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Stage changed while I was working. I skipped the updates that conflicted.",
          });
          merged.state.messages = merged.state.messages.slice(-24);
        }
        outcomeDetail = [
          outcomeDetail,
          "Stage changed while this turn was working. Conflicting Stage updates were skipped.",
        ].filter(Boolean).join(" ");
      }
      const summarized = withCallSummary({
        turnId,
        at: new Date().toISOString(),
        userMessage: args.message,
        selected,
        candidates: routed.ranked,
        fellBack,
        fallbackReason,
        routerMs: routed.routerMs,
        correction,
        specialistIds: merged.state.subagents
          ?.filter((job) => !current.stage.subagents?.some((prior) => prior.id === job.id))
          .map((job) => job.id),
        outcome,
        outcomeDetail,
        calls,
        eval: { signal: null, note: null },
      });

      trace.record({ kind: "done", t: trace.t(), outcome, totals: summarized.totals });
      const insight: JevStageTurnInsight = { ...summarized, trace: [...trace.events] };
      const next: JevStageBundle = {
        stage: merged.state,
        insights: [...current.insights, insight].slice(-JEV_STAGE_MAX_TURN_INSIGHTS),
      };

      signal.throwIfAborted();
      await finishJevStageRequest(args.ownerId, turnId, saveLease, admittedUntil, next);
      args.emit({ type: "done", insight, stage: next.stage });
      return next;
    } finally {
      await releaseJevStageLease(args.ownerId, saveLease);
    }
  } finally {
    await endJevStageRequest(args.ownerId, args.requestId, admittedUntil);
  }
}

export async function resetJevStage(ownerId: string): Promise<JevStageBundle> {
  const { emptyJevStageBundle } = await import("./schema");
  const next = emptyJevStageBundle();

  const reset = await mutateJevStage(ownerId, async (current) => {
    if (
      current.stage.subagents?.some((job) => job.status === "working" || job.status === "canceling") ||
      (await activeJevStageRequests(ownerId)).length
    ) {
      throw new JevStageTurnError("Wait for active requests before resetting Stage.", 409);
    }
    return { ...next, stage: { ...next.stage, revision: current.stage.revision + 1 } };
  });

  if (!reset) throw new JevStageTurnError("Wait for the current turn before resetting Stage.", 409);

  return reset;
}

export async function setJevStageTurnEval(args: {
  ownerId: string;
  turnId: string;
  signal: "up" | "down";
  note?: string | null;
}): Promise<JevStageBundle> {
  const next = await mutateJevStage(args.ownerId, (bundle) => ({
    ...bundle,
    stage: { ...bundle.stage, revision: bundle.stage.revision + 1 },
    insights: bundle.insights.map((insight) =>
      insight.turnId === args.turnId
        ? {
            ...insight,
            eval: {
              signal: args.signal,
              note: args.note?.trim() ? args.note.trim().slice(0, 500) : null,
            },
          }
        : insight
    ),
  }));

  if (!next) throw new JevStageTurnError("Wait for the current turn before saving feedback.", 409);

  return next;
}
