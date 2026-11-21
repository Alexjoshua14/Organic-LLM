import { describe, expect, test } from "bun:test";

import {
  initialInsightPager,
  insightPage,
  insightPagerReducer,
} from "@/lib/jev-stage/insight-pager";
import type { JevStageTraceEvent, JevStageTurnInsight } from "@/lib/jev-stage/schema";
import {
  buildJevTraceView,
  emptyJevTraceView,
  foldJevTrace,
  formatTraceUsd,
  jevTracePath,
  jevTraceTimeline,
  traceForInsight,
} from "@/lib/jev-stage/trace-view";

const call = {
  id: "call-1",
  operation: "respond",
  model: "openai/gpt-6-luna",
  inputTokens: 8735,
  outputTokens: 495,
  cachedInputTokens: 5722,
  costUsd: 0.004213,
  latencyMs: 19_400,
  timeToFirstTokenMs: 900,
  tokensPerSecond: 25,
};

const turn: JevStageTraceEvent[] = [
  { kind: "jev.start", t: 0 },
  {
    kind: "jev.end",
    t: 460,
    ms: 455,
    source: "jev",
    distribution: [
      { kind: "respond", p: 0.51 },
      { kind: "memory_search", p: 0.17 },
      { kind: "recall", p: 0.15 },
    ],
    choice: "respond",
    floor: 0.45,
    belowFloor: false,
    error: null,
    inputTokens: 1200,
    outputTokens: 2,
    costUsd: 0.0000504,
  },
  { kind: "action", t: 461, action: "respond", via: "jev", reason: "Jev p=0.51 (chosen)" },
  { kind: "hop.start", t: 470, hopId: "h1", operation: "respond", action: "respond", model: "openai/gpt-6-luna" },
  {
    kind: "hop.tool",
    t: 2100,
    hopId: "h1",
    tool: { name: "search_memories", args: '{"query":"Organic LLM"}', result: "4 memories", ms: 600, ok: true, effect: null },
  },
  {
    kind: "hop.step",
    t: 2200,
    hopId: "h1",
    step: {
      index: 0,
      ms: 1730,
      tools: [{ name: "search_memories", args: "{}", result: null }],
      inputTokens: 4000,
      outputTokens: 30,
      cachedInputTokens: 2000,
      costUsd: 0.0011,
      finishReason: "tool-calls",
    },
  },
  {
    kind: "hop.tool",
    t: 3000,
    hopId: "h1",
    tool: { name: "switch_view", args: "{}", result: "That view is not available.", ms: 1, ok: false, effect: "View switched" },
  },
];

describe("jev-stage trace view reducer", () => {
  test("a live turn shows Jev done and the Respond hop active with its tools", () => {
    const view = buildJevTraceView(turn);

    expect(view.decision?.choice).toBe("respond");
    expect(view.hops).toHaveLength(1);
    expect(view.hops[0]!.status).toBe("active");
    // Live tools (with timing) replace the step's own list; the next tool waits for its step.
    expect(view.hops[0]!.steps[0]!.tools[0]).toMatchObject({ result: "4 memories", ms: 600 });
    expect(view.hops[0]!.pendingTools.map((tool) => tool.name)).toEqual(["switch_view"]);

    const path = jevTracePath(view);

    expect(path.map((node) => [node.id, node.status])).toEqual([
      ["jev", "done"],
      ["action", "done"],
      ["h1", "active"],
      ["h1:tools", "failed"],
      ["reply", "pending"],
    ]);
  });

  test("before Jev answers, the Jev node is the active one", () => {
    const view = foldJevTrace(emptyJevTraceView(), { kind: "jev.start", t: 0 });

    expect(jevTracePath(view)[0]).toMatchObject({ id: "jev", status: "active", detail: "deciding" });
    expect(jevTraceTimeline(view).rows[0]).toMatchObject({ kind: "jev", status: "active" });
  });

  test("the timeline lists decision, hop, step and tools in order with counts", () => {
    const view = buildJevTraceView([
      ...turn,
      { kind: "hop.end", t: 19_900, hopId: "h1", ms: 19_400, ok: true, call, note: null },
      { kind: "fallback", t: 19_901, from: "respond", to: "safety", reason: "nothing visible" },
      { kind: "done", t: 19_950, outcome: "ok", totals: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, costUsd: 0.0042, latencyMs: 1 } },
    ]);
    const timeline = jevTraceTimeline(view);

    expect(timeline.rows.map((row) => [row.kind, row.title])).toEqual([
      ["jev", "Jev decision"],
      ["hop", "Respond · gpt-6-luna"],
      ["step", "Step 1 · gpt-6-luna"],
      ["tool", "search_memories"],
      ["tool", "switch_view · View switched"],
      ["fallback", "Fallback respond → safety"],
    ]);
    expect(timeline.steps).toBe(2);
    expect(timeline.tools).toBe(2);
    expect(timeline.rows[3]!.detail).toBe('{"query":"Organic LLM"} → 4 memories');
    expect(timeline.rows[4]!.status).toBe("failed");
    expect(view.hops[0]!.status).toBe("done");
    expect(jevTracePath(view).at(-1)).toMatchObject({ id: "reply", status: "done" });
  });

  test("done closes a hop whose stream ended without hop.end", () => {
    const view = buildJevTraceView([
      ...turn.slice(0, 4),
      { kind: "done", t: 900, outcome: "error", totals: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0, latencyMs: 0 } },
    ]);

    expect(view.hops[0]!.status).toBe("done");
    expect(jevTracePath(view).at(-1)!.status).toBe("failed");
  });

  test("costs keep four significant digits, never a <$0.01 floor", () => {
    expect(formatTraceUsd(0.00031)).toBe("$0.00031");
    expect(formatTraceUsd(0.0000504)).toBe("$0.0000504");
    expect(formatTraceUsd(0.004213456)).toBe("$0.004213");
    expect(formatTraceUsd(0)).toBe("$0");
  });

  test("legacy insights without a trace replay from candidates and calls", () => {
    const insight = {
      turnId: "00000000-0000-4000-8000-000000000001",
      at: new Date(0).toISOString(),
      userMessage: "hi",
      selected: { kind: "respond", confidence: 0.51, reason: "Below floor 0.55; defaulting to respond", args: {} },
      candidates: [
        { kind: "respond", confidence: 0.51, reason: "", args: {} },
        { kind: "recall", confidence: 0.15, reason: "", args: {} },
      ],
      fellBack: true,
      fallbackReason: "top confidence 0.51 < 0.55",
      routerMs: 400,
      outcome: "ok",
      outcomeDetail: null,
      calls: [{ ...call, id: "jev", operation: "jev.route", model: "typesafe-ai/jev", costUsd: 0.00005 }, call],
      totals: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, costUsd: 0.004, latencyMs: 1 },
      perModelSpendUsd: {},
      eval: { signal: null, note: null },
    } satisfies JevStageTurnInsight;
    const view = buildJevTraceView(traceForInsight(insight));

    expect(view.decision).toMatchObject({ source: "jev", belowFloor: true, costUsd: 0.00005 });
    expect(view.action?.via).toBe("floor");
    expect(view.hops.map((hop) => [hop.model, hop.status])).toEqual([["openai/gpt-6-luna", "done"]]);
    expect(view.done?.outcome).toBe("ok");
    expect(traceForInsight({ ...insight, trace: turn })).toBe(turn);
  });
});

describe("jev-stage insight pager", () => {
  test("follows the newest page by default, so a new turn moves Insight to it", () => {
    const pager = initialInsightPager();

    expect(insightPage(pager, 3)).toBe(2);
    expect(insightPage(pager, 4)).toBe(3);
  });

  test("paging back stops following and stays put when turns arrive", () => {
    const back = insightPagerReducer(initialInsightPager(), { type: "prev", count: 4 });

    expect(back).toEqual({ follow: false, index: 2 });
    expect(insightPage(back, 5)).toBe(2);
  });

  test("paging forward onto the newest page follows again", () => {
    let pager = insightPagerReducer(initialInsightPager(), { type: "prev", count: 3 });

    pager = insightPagerReducer(pager, { type: "next", count: 3 });
    expect(pager.follow).toBe(true);
    expect(insightPage(pager, 4)).toBe(3);
  });

  test("the toggle keeps the current page when turned off and jumps to newest when on", () => {
    const off = insightPagerReducer(initialInsightPager(), { type: "toggle", count: 3 });

    expect(off).toEqual({ follow: false, index: 2 });
    expect(insightPage(off, 4)).toBe(2);
    const on = insightPagerReducer(off, { type: "toggle", count: 4 });

    expect(on).toEqual({ follow: true, index: 3 });
  });

  test("handles an empty history", () => {
    expect(insightPage(initialInsightPager(), 0)).toBe(0);
    expect(insightPagerReducer(initialInsightPager(), { type: "next", count: 0 })).toEqual({
      follow: true,
      index: 0,
    });
  });
});
