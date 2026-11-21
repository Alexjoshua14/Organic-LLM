import {
  JevStageActionKindSchema,
  type JevStageActionKind,
  type JevStageActionVia,
  type JevStageCandidate,
  type JevStageHopStep,
  type JevStageToolTrace,
  type JevStageTraceEvent,
} from "./schema";

/**
 * Builders for the Jev Stage pipeline trace (COA-755). The turn records each stage as it happens
 * and streams it to the insight panel; nothing here calls a model, so it is unit-testable.
 */

/** Longest summary of a tool's args or result in a trace row. */
export const JEV_TRACE_VALUE_CHARS = 96;

/** Most tool calls kept per hop step; a runaway loop should not bloat the stored insight. */
export const JEV_TRACE_MAX_TOOLS_PER_STEP = 8;

const ACTION_KINDS = JevStageActionKindSchema.options;

/** Compact one-line summary of a tool value, truncated with an ellipsis. */
export function summarizeTraceValue(value: unknown, max = JEV_TRACE_VALUE_CHARS): string {
  let text: string;

  if (value === undefined) return "";
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value) ?? String(value);
    } catch {
      text = String(value);
    }
  }
  text = text.replace(/\s+/g, " ").trim();

  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

/** Structural view of an AI SDK step: only the fields the trace reads. */
export type JevStepLike = {
  toolCalls?: ReadonlyArray<{ toolCallId?: string; toolName: string; input?: unknown }>;
  toolResults?: ReadonlyArray<{ toolCallId?: string; toolName: string; output?: unknown }>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: { cacheReadTokens?: number };
  };
  finishReason?: string;
};

/** Pair each tool call in a step with its result (by call id, else by name). */
export function stepTools(step: JevStepLike): JevStageToolTrace[] {
  const results = [...(step.toolResults ?? [])];

  return (step.toolCalls ?? []).slice(0, JEV_TRACE_MAX_TOOLS_PER_STEP).map((call) => {
    const index = results.findIndex((result) =>
      call.toolCallId && result.toolCallId
        ? result.toolCallId === call.toolCallId
        : result.toolName === call.toolName
    );
    const result = index >= 0 ? results.splice(index, 1)[0] : undefined;

    return {
      name: call.toolName,
      args: summarizeTraceValue(call.input),
      result: result ? summarizeTraceValue(result.output) : null,
    };
  });
}

export function hopStep(args: {
  index: number;
  ms: number;
  step: JevStepLike;
  costUsd: number;
}): JevStageHopStep {
  return {
    index: args.index,
    ms: Math.max(0, Math.round(args.ms)),
    tools: stepTools(args.step),
    inputTokens: args.step.usage?.inputTokens ?? 0,
    outputTokens: args.step.usage?.outputTokens ?? 0,
    cachedInputTokens: args.step.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
    costUsd: args.costUsd,
    finishReason: args.step.finishReason ?? null,
  };
}

/** What Respond / Orchestrate report to the turn while they run. */
export type JevHopSignal =
  | { kind: "start"; model: string }
  | { kind: "first_token" }
  | { kind: "step"; step: JevStageHopStep };

/** The slice of `routeJevStage`'s result the decision event reads. */
export type JevRoutedLike = {
  source: "jev" | "fallback";
  route: { candidates: JevStageCandidate[] };
  routerMs: number;
  fallbackReason: string | null;
  choice: JevStageActionKind | null;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
};

/** The Jev decision as a trace event: every action's probability, the floor and its effect. */
export function jevDecisionEvent(
  t: number,
  routed: JevRoutedLike,
  floor: number
): Extract<JevStageTraceEvent, { kind: "jev.end" }> {
  const scored = new Map<JevStageActionKind, number>();

  if (routed.source === "jev") {
    for (const candidate of routed.route.candidates) scored.set(candidate.kind, candidate.confidence);
  }
  const distribution =
    routed.source === "jev"
      ? ACTION_KINDS.map((kind) => ({ kind, p: scored.get(kind) ?? 0 })).sort((a, b) => b.p - a.p)
      : [];
  const top = distribution[0];

  return {
    kind: "jev.end",
    t,
    ms: Math.round(routed.routerMs),
    source: routed.source,
    distribution,
    choice: routed.choice,
    floor,
    belowFloor: !!top && top.p < floor,
    error: routed.source === "fallback" ? routed.fallbackReason : null,
    inputTokens: routed.usage.inputTokens,
    outputTokens: routed.usage.outputTokens,
    costUsd: routed.costUsd,
  };
}

/** How the turn arrived at its first action. */
export function actionVia(args: {
  source: "jev" | "fallback";
  belowFloor: boolean;
  blocked: boolean;
}): JevStageActionVia {
  if (args.blocked) return "blocked";
  if (args.source === "fallback") return "jev_error";

  return args.belowFloor ? "floor" : "jev";
}

/**
 * Collects a turn's trace and streams each event as it is recorded. `now` is injectable so tests
 * can drive the clock.
 */
export function createJevTraceRecorder(
  emit: (event: JevStageTraceEvent) => void,
  now: () => number = () => performance.now()
) {
  const started = now();
  const events: JevStageTraceEvent[] = [];

  return {
    events,
    /** Milliseconds since the turn started. */
    t: () => Math.max(0, Math.round(now() - started)),
    record(event: JevStageTraceEvent) {
      events.push(event);
      emit(event);
    },
  };
}

export type JevTraceRecorder = ReturnType<typeof createJevTraceRecorder>;

/**
 * Listener for one LLM hop: records hop.start / first token / steps against a hop id. Steps are
 * timed from the previous step (or the hop start).
 */
export function hopListener(trace: JevTraceRecorder, hopId: string, action: JevStageActionKind, operation: "respond" | "orchestrate") {
  let firstToken = false;

  return (signal: JevHopSignal) => {
    if (signal.kind === "start") {
      trace.record({ kind: "hop.start", t: trace.t(), hopId, operation, action, model: signal.model });
    } else if (signal.kind === "first_token") {
      if (firstToken) return;
      firstToken = true;
      trace.record({ kind: "hop.first_token", t: trace.t(), hopId });
    } else {
      trace.record({ kind: "hop.step", t: trace.t(), hopId, step: signal.step });
    }
  };
}
