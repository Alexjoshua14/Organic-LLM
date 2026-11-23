import type {
  JevStageActionKind,
  JevStageModelCallTrace,
  JevStageToolTrace,
  JevStageTraceEvent,
  JevStageTurnInsight,
} from "./schema";

/**
 * Folds the Jev Stage pipeline trace (COA-755) into what the insight panel draws. The same fold
 * runs on live NDJSON events for the in-flight turn and on the stored trace of past turns.
 */

type Ev<K extends JevStageTraceEvent["kind"]> = Extract<JevStageTraceEvent, { kind: K }>;

export type JevTraceStepView = {
  index: number;
  ms: number;
  tools: JevStageToolTrace[];
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  finishReason: string | null;
};

export type JevTraceHopView = {
  hopId: string;
  operation: Ev<"hop.start">["operation"];
  action: JevStageActionKind;
  model: string | null;
  startT: number;
  endT: number | null;
  firstTokenT: number | null;
  status: "active" | "done" | "failed";
  steps: JevTraceStepView[];
  /** Tools reported live that no finished step has claimed yet. */
  pendingTools: JevStageToolTrace[];
  call: JevStageModelCallTrace | null;
  note: string | null;
};

export type JevTraceView = {
  started: boolean;
  decision: Ev<"jev.end"> | null;
  action: Ev<"action"> | null;
  hops: JevTraceHopView[];
  contexts: Ev<"hop.context">[];
  fallbacks: Ev<"fallback">[];
  done: Ev<"done"> | null;
  lastT: number;
};

export function emptyJevTraceView(): JevTraceView {
  return {
    started: false,
    decision: null,
    action: null,
    hops: [],
    contexts: [],
    fallbacks: [],
    done: null,
    lastT: 0,
  };
}

function updateHop(
  view: JevTraceView,
  hopId: string,
  change: (hop: JevTraceHopView) => JevTraceHopView
): JevTraceHopView[] {
  return view.hops.map((hop) => (hop.hopId === hopId ? change(hop) : hop));
}

/** Pure reducer: one trace event into the view. Unknown hop ids are ignored. */
export function foldJevTrace(view: JevTraceView, event: JevStageTraceEvent): JevTraceView {
  const next = { ...view, started: true, lastT: Math.max(view.lastT, event.t) };

  switch (event.kind) {
    case "jev.start":
      return next;
    case "jev.end":
      return { ...next, decision: event };
    case "action":
      return { ...next, action: event };
    case "hop.start":
      if (view.hops.some((hop) => hop.hopId === event.hopId)) return next;

      return {
        ...next,
        hops: [
          ...view.hops,
          {
            hopId: event.hopId,
            operation: event.operation,
            action: event.action,
            model: event.model,
            startT: event.t,
            endT: null,
            firstTokenT: null,
            status: "active",
            steps: [],
            pendingTools: [],
            call: null,
            note: null,
          },
        ],
      };
    case "hop.first_token":
      return {
        ...next,
        hops: updateHop(view, event.hopId, (hop) => ({ ...hop, firstTokenT: hop.firstTokenT ?? event.t })),
      };
    case "hop.context":
      return { ...next, contexts: [...view.contexts, event] };
    case "hop.tool":
      return {
        ...next,
        hops: updateHop(view, event.hopId, (hop) => ({
          ...hop,
          pendingTools: [...hop.pendingTools, event.tool],
        })),
      };
    case "hop.step":
      return {
        ...next,
        hops: updateHop(view, event.hopId, (hop) => ({
          ...hop,
          // Live tools carry timing and ok/error; the step's own list is the fallback.
          steps: [
            ...hop.steps,
            { ...event.step, tools: hop.pendingTools.length ? hop.pendingTools : event.step.tools },
          ],
          pendingTools: [],
        })),
      };
    case "hop.end":
      return {
        ...next,
        hops: updateHop(view, event.hopId, (hop) => ({
          ...hop,
          endT: event.t,
          status: event.ok ? "done" : "failed",
          call: event.call,
          note: event.note,
          model: hop.model ?? event.call?.model ?? null,
        })),
      };
    case "fallback":
      return { ...next, fallbacks: [...view.fallbacks, event] };
    case "done":
      return {
        ...next,
        done: event,
        // A finished turn has no active hop, even if a stream ended without hop.end.
        hops: view.hops.map((hop) =>
          hop.status === "active" ? { ...hop, status: "done", endT: hop.endT ?? event.t } : hop
        ),
      };
  }
}

export function buildJevTraceView(events: ReadonlyArray<JevStageTraceEvent>): JevTraceView {
  return events.reduce(foldJevTrace, emptyJevTraceView());
}

/**
 * The trace for a stored insight. Records from before COA-755 have none, so one is synthesized
 * from the candidates and model calls they do carry.
 */
export function traceForInsight(insight: JevStageTurnInsight): JevStageTraceEvent[] {
  if (insight.trace?.length) return insight.trace;
  const jevFailed =
    insight.candidates.length === 1 && insight.candidates[0]!.reason.startsWith("Jev unavailable");
  const ranked = [...insight.candidates].sort((a, b) => b.confidence - a.confidence);
  const route = insight.calls.find((call) => call.operation === "jev.route");
  const events: JevStageTraceEvent[] = [
    { kind: "jev.start", t: 0 },
    {
      kind: "jev.end",
      t: Math.round(insight.routerMs),
      ms: Math.round(insight.routerMs),
      source: jevFailed ? "fallback" : "jev",
      distribution: jevFailed ? [] : ranked.map((c) => ({ kind: c.kind, p: c.confidence })),
      choice: jevFailed ? null : (ranked[0]?.kind ?? null),
      floor: 0,
      belowFloor: !jevFailed && /below floor/i.test(insight.selected.reason),
      error: jevFailed ? insight.fallbackReason : null,
      inputTokens: route?.inputTokens ?? 0,
      outputTokens: route?.outputTokens ?? 0,
      costUsd: route?.costUsd ?? 0,
    },
    {
      kind: "action",
      t: Math.round(insight.routerMs),
      action: insight.selected.kind,
      via: jevFailed ? "jev_error" : insight.fellBack ? "floor" : "jev",
      reason: insight.selected.reason,
    },
  ];
  let t = Math.round(insight.routerMs);

  for (const call of insight.calls) {
    if (call.operation === "jev.route") continue;
    const hopId = call.id;
    const operation = call.operation === "design" ? "design" : call.operation === "orchestrate" ? "orchestrate" : "respond";
    const action = operation === "design" ? "designer_brief" : operation;

    events.push({ kind: "hop.start", t, hopId, operation, action, model: call.model });
    t += Math.round(call.latencyMs);
    events.push({ kind: "hop.end", t, hopId, ms: call.latencyMs, ok: true, call, note: null });
  }
  events.push({ kind: "done", t, outcome: insight.outcome, totals: insight.totals });

  return events;
}

export function shortModel(model: string | null): string {
  return model ? (model.split("/").pop() ?? model) : "";
}

/** USD to four significant digits ($0.00031), never a "<$0.01" floor. */
export function formatTraceUsd(value: number): string {
  if (!value) return "$0";

  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
}

export function formatTraceMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : `${Math.round(ms)}ms`;
}

export type JevTraceNodeStatus = "pending" | "active" | "done" | "failed";

export type JevTraceNode = {
  id: string;
  label: string;
  detail: string;
  status: JevTraceNodeStatus;
};

/** The live path diagram: Jev → action → each hop (and its tools) → reply. */
export function jevTracePath(view: JevTraceView): JevTraceNode[] {
  const { decision } = view;
  const top = decision?.distribution[0];
  const nodes: JevTraceNode[] = [
    {
      id: "jev",
      label: "Jev",
      detail: !decision
        ? view.started
          ? "deciding"
          : "waiting"
        : decision.source === "fallback"
          ? "unavailable"
          : top
            ? `p ${top.p.toFixed(2)}`
            : "decided",
      status: !decision ? (view.started ? "active" : "pending") : decision.source === "fallback" ? "failed" : "done",
    },
    {
      id: "action",
      label: view.action?.action ?? "action",
      detail: view.action ? VIA_LABEL[view.action.via] : "",
      status: view.action ? "done" : "pending",
    },
  ];

  for (const hop of view.hops) {
    nodes.push({
      id: hop.hopId,
      label: hop.operation === "direct" ? hop.action : shortModel(hop.model) || hop.operation,
      detail: hop.operation === "direct" ? "direct tool" : hop.operation,
      status: hop.status,
    });
    const tools = hopTools(hop);

    if (tools.length) {
      nodes.push({
        id: `${hop.hopId}:tools`,
        label: tools.length === 1 ? tools[0]!.name : `${tools.length} tools`,
        detail: tools.some((tool) => tool.ok === false) ? "error" : "tools",
        status: tools.some((tool) => tool.ok === false)
          ? "failed"
          : hop.status === "active"
            ? "active"
            : "done",
      });
    }
  }
  nodes.push({
    id: "reply",
    label: "Reply",
    detail: view.done ? view.done.outcome : "",
    status: view.done ? (view.done.outcome === "ok" ? "done" : "failed") : "pending",
  });

  return nodes;
}

export const VIA_LABEL: Record<Ev<"action">["via"], string> = {
  jev: "Jev's pick",
  floor: "below floor",
  jev_error: "Jev unavailable",
  blocked: "blocked",
};

export function hopTools(hop: JevTraceHopView): JevStageToolTrace[] {
  return [...hop.steps.flatMap((step) => step.tools), ...hop.pendingTools];
}

export type JevTraceRow = {
  id: string;
  kind: "jev" | "hop" | "step" | "tool" | "fallback";
  depth: 0 | 1 | 2;
  title: string;
  detail: string;
  ms: number | null;
  costUsd: number | null;
  status: JevTraceNodeStatus;
};

/** The hop timeline, in order, flattened for rendering, with its step and tool counts. */
export function jevTraceTimeline(view: JevTraceView): {
  rows: JevTraceRow[];
  steps: number;
  tools: number;
} {
  const rows: JevTraceRow[] = [];
  let steps = 0;
  let tools = 0;
  const { decision } = view;

  if (decision || view.started) {
    steps += 1;
    rows.push({
      id: "jev",
      kind: "jev",
      depth: 0,
      title: "Jev decision",
      detail: !decision
        ? "deciding…"
        : decision.source === "fallback"
          ? `unavailable: ${decision.error ?? "no choice"}`
          : `${decision.choice ?? "—"}${view.action ? ` → ${view.action.action} (${VIA_LABEL[view.action.via]})` : ""}`,
      ms: decision?.ms ?? null,
      costUsd: decision?.costUsd ?? null,
      status: !decision ? "active" : decision.source === "fallback" ? "failed" : "done",
    });
  }

  const entries: Array<{ t: number; hop?: JevTraceHopView; fallback?: Ev<"fallback"> }> = [
    ...view.hops.map((hop) => ({ t: hop.startT, hop })),
    ...view.fallbacks.map((fallback) => ({ t: fallback.t, fallback })),
  ].sort((a, b) => a.t - b.t);

  for (const entry of entries) {
    if (entry.fallback) {
      rows.push({
        id: `fallback:${entry.fallback.t}:${entry.fallback.from}`,
        kind: "fallback",
        depth: 0,
        title: `Fallback ${entry.fallback.from} → ${entry.fallback.to}`,
        detail: entry.fallback.reason,
        ms: null,
        costUsd: null,
        status: "failed",
      });
      continue;
    }
    const hop = entry.hop!;
    const model = shortModel(hop.model);

    rows.push({
      id: hop.hopId,
      kind: "hop",
      depth: 0,
      title: hop.operation === "direct" ? `Direct · ${hop.action}` : `${hop.operation === "respond" ? "Respond" : hop.operation === "design" ? "Designer" : "Orchestrate"}${model ? ` · ${model}` : ""}`,
      detail: hop.note ?? (hop.firstTokenT != null ? `first token ${formatTraceMs(hop.firstTokenT - hop.startT)}` : hop.status === "active" ? "running…" : ""),
      ms: hop.call?.latencyMs ?? (hop.endT != null ? hop.endT - hop.startT : null),
      costUsd: hop.call?.costUsd ?? null,
      status: hop.status,
    });
    if (hop.operation === "direct") steps += 1;
    for (const step of hop.steps) {
      steps += 1;
      rows.push({
        id: `${hop.hopId}:step:${step.index}`,
        kind: "step",
        depth: 1,
        title: `Step ${step.index + 1}${model ? ` · ${model}` : ""}`,
        detail: `in ${step.inputTokens} · out ${step.outputTokens} · cached ${step.cachedInputTokens}${step.finishReason ? ` · ${step.finishReason}` : ""}`,
        ms: step.ms,
        costUsd: step.costUsd,
        status: "done",
      });
      step.tools.forEach((tool, index) => {
        tools += 1;
        rows.push(toolRow(`${hop.hopId}:step:${step.index}:tool:${index}`, tool));
      });
    }
    hop.pendingTools.forEach((tool, index) => {
      tools += 1;
      rows.push(toolRow(`${hop.hopId}:pending:${index}`, tool));
    });
  }

  return { rows, steps, tools };
}

function toolRow(id: string, tool: JevStageToolTrace): JevTraceRow {
  const parts = [tool.args, tool.result ? `→ ${tool.result}` : ""].filter(Boolean);

  return {
    id,
    kind: "tool",
    depth: 2,
    title: tool.effect ? `${tool.name} · ${tool.effect}` : tool.name,
    detail: parts.join(" "),
    ms: tool.ms ?? null,
    costUsd: null,
    status: tool.ok === false ? "failed" : "done",
  };
}

/** Plain-text debug dump for one Insight turn (copy to clipboard). */
export function formatJevInsightDebugLog(args: {
  insight?: Pick<
    JevStageTurnInsight,
    "turnId" | "at" | "userMessage" | "selected" | "fellBack" | "fallbackReason" | "outcome" | "outcomeDetail" | "calls" | "totals" | "eval"
  > | null;
  live?: { text: string; status: string } | null;
  trace: JevTraceView;
}): string {
  const { insight, live, trace } = args;
  const { rows } = jevTraceTimeline(trace);
  const lines: string[] = [
    "# Jev Stage turn debug",
    `turnId: ${insight?.turnId ?? "(live)"}`,
    `at: ${insight?.at ?? "in progress"}`,
    `user: ${insight?.userMessage ?? live?.text ?? ""}`,
  ];

  if (live?.status) lines.push(`liveStatus: ${live.status}`);
  if (insight) {
    lines.push(
      `selected: ${insight.selected.kind} (${insight.selected.confidence.toFixed(2)}) — ${insight.selected.reason}`,
      `fellBack: ${insight.fellBack}${insight.fallbackReason ? ` — ${insight.fallbackReason}` : ""}`,
      `outcome: ${insight.outcome}${insight.outcomeDetail ? ` — ${insight.outcomeDetail}` : ""}`,
      `totals: $${insight.totals.costUsd.toFixed(6)} · ${insight.totals.latencyMs}ms · in ${insight.totals.inputTokens} · out ${insight.totals.outputTokens} · cached ${insight.totals.cachedInputTokens}`,
      `eval: ${insight.eval.signal ?? "none"}${insight.eval.note ? ` — ${insight.eval.note}` : ""}`
    );
  }
  lines.push("", "## Timeline");
  for (const row of rows) {
    const indent = "  ".repeat(row.depth);
    const meta = [
      row.ms != null ? formatTraceMs(row.ms) : null,
      row.costUsd != null ? formatTraceUsd(row.costUsd) : null,
      row.status !== "done" ? row.status : null,
    ]
      .filter(Boolean)
      .join(" · ");

    lines.push(`${indent}- ${row.title}${meta ? ` (${meta})` : ""}`);
    if (row.detail) lines.push(`${indent}  ${row.detail}`);
  }
  if (insight?.calls.length) {
    lines.push("", "## Model calls");
    for (const call of insight.calls) {
      lines.push(
        `- ${call.operation} · ${call.model}: in ${call.inputTokens} · out ${call.outputTokens} · cached ${call.cachedInputTokens} · $${call.costUsd.toFixed(6)} · ${call.latencyMs}ms`
      );
    }
  }
  lines.push("", `path: ${jevTracePath(trace).map((node) => node.label).join(" → ")}`);

  return `${lines.join("\n")}\n`;
}
