import { describe, expect, test } from "bun:test";

import {
  JevStageTraceEventSchema,
  type JevStageToolTrace,
  type JevStageTraceEvent,
} from "@/lib/jev-stage/schema";
import {
  actionVia,
  createJevTraceRecorder,
  hopListener,
  hopStep,
  jevDecisionEvent,
  JEV_TRACE_VALUE_CHARS,
  stepTools,
  summarizeToolResult,
  summarizeTraceValue,
  toolEffect,
  traceToolSet,
  type JevRoutedLike,
} from "@/lib/jev-stage/trace-events";

function routed(overrides: Partial<JevRoutedLike> = {}): JevRoutedLike {
  return {
    source: "jev",
    route: {
      candidates: [
        { kind: "captures", confidence: 0.71, reason: "", args: {} },
        { kind: "respond", confidence: 0.2, reason: "", args: {} },
        { kind: "recall", confidence: 0.09, reason: "", args: {} },
      ],
    },
    routerMs: 412.4,
    fallbackReason: null,
    choice: "captures",
    usage: { inputTokens: 1200, outputTokens: 2 },
    costUsd: 0.00005,
    ...overrides,
  };
}

describe("jev-stage trace events", () => {
  test("the decision event lists every action, highest first, with the floor", () => {
    const event = jevDecisionEvent(420, routed(), 0.55);

    expect(event.distribution).toHaveLength(9);
    expect(event.distribution.slice(0, 3).map((entry) => entry.kind)).toEqual([
      "captures",
      "respond",
      "recall",
    ]);
    expect(event.distribution.at(-1)?.p).toBe(0);
    expect(event.floor).toBe(0.55);
    expect(event.belowFloor).toBe(false);
    expect(event.ms).toBe(412);
    expect(event.choice).toBe("captures");
    expect(JevStageTraceEventSchema.safeParse(event).success).toBe(true);
  });

  test("a top probability under the floor is flagged and routes via the floor", () => {
    const event = jevDecisionEvent(
      10,
      routed({
        route: {
          candidates: [
            { kind: "orchestrate", confidence: 0.4, reason: "", args: {} },
            { kind: "respond", confidence: 0.35, reason: "", args: {} },
          ],
        },
      }),
      0.55
    );

    expect(event.belowFloor).toBe(true);
    expect(actionVia({ source: "jev", belowFloor: true, blocked: false })).toBe("floor");
  });

  test("a low-probability respond pick is not a floor fallback", () => {
    const event = jevDecisionEvent(
      10,
      routed({
        route: {
          candidates: [
            { kind: "respond", confidence: 0.4, reason: "", args: {} },
            { kind: "recall", confidence: 0.3, reason: "", args: {} },
          ],
        },
      }),
      0.45
    );

    expect(event.belowFloor).toBe(false);
  });

  test("a failed Jev call has no distribution and carries the error", () => {
    const event = jevDecisionEvent(
      5,
      routed({ source: "fallback", choice: null, fallbackReason: "timeout" }),
      0.55
    );

    expect(event.distribution).toEqual([]);
    expect(event.belowFloor).toBe(false);
    expect(event.error).toBe("timeout");
    expect(actionVia({ source: "fallback", belowFloor: false, blocked: false })).toBe("jev_error");
    expect(actionVia({ source: "jev", belowFloor: false, blocked: true })).toBe("blocked");
  });

  test("tool values are summarized on one line and truncated", () => {
    expect(summarizeTraceValue({ query: "tide clock" })).toBe('{"query":"tide clock"}');
    expect(summarizeTraceValue("tide\n   clock")).toBe("tide clock");
    const long = summarizeTraceValue("x".repeat(500));

    expect(long).toHaveLength(JEV_TRACE_VALUE_CHARS);
    expect(long.endsWith("…")).toBe(true);
    expect(summarizeTraceValue(undefined)).toBe("");
  });

  test("step tools pair calls with results by call id", () => {
    const tools = stepTools({
      toolCalls: [
        { toolCallId: "a", toolName: "search_memories", input: { query: "moss" } },
        { toolCallId: "b", toolName: "switch_view", input: { view: { kind: "overview" } } },
      ],
      toolResults: [{ toolCallId: "a", toolName: "search_memories", output: { hits: 2 } }],
    });

    expect(tools).toEqual([
      { name: "search_memories", args: '{"query":"moss"}', result: '{"hits":2}', effect: null },
      { name: "switch_view", args: '{"view":{"kind":"overview"}}', result: null, effect: "View switched" },
    ]);
  });

  test("tool results summarize as counts, errors or compact JSON", () => {
    expect(summarizeToolResult({ ok: true, memories: [1, 2, 3, 4] })).toBe("4 memories");
    expect(summarizeToolResult({ memories: [1] })).toBe("1 memory");
    expect(summarizeToolResult([1, 2])).toBe("2 results");
    expect(summarizeToolResult({ ok: false, error: "That view is not available." })).toBe(
      "That view is not available."
    );
    expect(summarizeToolResult({ ok: true })).toBe("ok");
    expect(summarizeToolResult({ ok: true, queued: 2 })).toBe("2 queued");
    expect(toolEffect("switch_view")).toBe("View switched");
    expect(toolEffect("search_memories")).toBeNull();
  });

  test("traceToolSet times each execution and reports ok, error and effect", async () => {
    let clock = 0;
    const seen: JevStageToolTrace[] = [];
    const tools = traceToolSet(
      {
        search_memories: {
          description: "search",
          execute: async (input: { query: string }) => {
            clock += 120;

            return { memories: [input.query, input.query] };
          },
        },
        switch_view: {
          execute: async () => ({ ok: false, error: "That view is not available." }),
        },
        broken: {
          execute: async () => {
            clock += 5;
            throw new Error("boom");
          },
        },
        passive: { description: "no execute" },
      },
      (tool) => seen.push(tool),
      () => clock
    );

    expect(await tools.search_memories.execute({ query: "moss" })).toEqual({
      memories: ["moss", "moss"],
    });
    await tools.switch_view.execute();
    await expect(tools.broken.execute()).rejects.toThrow("boom");
    expect(tools.search_memories.description).toBe("search");
    expect(tools.passive).toEqual({ description: "no execute" });
    expect(seen).toEqual([
      { name: "search_memories", args: '{"query":"moss"}', result: "2 memories", ms: 120, ok: true, effect: null, output: JSON.stringify({ memories: ["moss", "moss"] }, null, 2) },
      { name: "switch_view", args: "", result: "That view is not available.", ms: 0, ok: false, effect: "View switched", output: JSON.stringify({ ok: false, error: "That view is not available." }, null, 2) },
      { name: "broken", args: "", result: "boom", ms: 5, ok: false, effect: null },
    ]);
  });

  test("a hop listener records live tool events", () => {
    const trace = createJevTraceRecorder(() => undefined, () => 0);
    const onHop = hopListener(trace, "hop-2", "orchestrate", "orchestrate");

    onHop({ kind: "tool", tool: { name: "web_search", args: "{}", result: "3 results", ms: 40, ok: true } });
    expect(trace.events[0]).toMatchObject({ kind: "hop.tool", hopId: "hop-2", tool: { name: "web_search" } });
    expect(JevStageTraceEventSchema.safeParse(trace.events[0]).success).toBe(true);
  });

  test("hopStep reads usage and rounds time", () => {
    const step = hopStep({
      index: 1,
      ms: 812.7,
      costUsd: 0.002,
      step: {
        usage: { inputTokens: 900, outputTokens: 40, inputTokenDetails: { cacheReadTokens: 600 } },
        finishReason: "tool-calls",
      },
    });

    expect(step).toMatchObject({
      index: 1,
      ms: 813,
      inputTokens: 900,
      outputTokens: 40,
      cachedInputTokens: 600,
      finishReason: "tool-calls",
      tools: [],
    });
  });

  test("the recorder stamps time from turn start and streams every event in order", () => {
    let clock = 1000;
    const streamed: JevStageTraceEvent[] = [];
    const trace = createJevTraceRecorder((event) => streamed.push(event), () => clock);

    trace.record({ kind: "jev.start", t: trace.t() });
    clock = 1400;
    trace.record(jevDecisionEvent(trace.t(), routed(), 0.55));
    const onHop = hopListener(trace, "hop-1", "respond", "respond");

    clock = 1450;
    onHop({ kind: "start", model: "anthropic/claude-haiku-4.5" });
    clock = 1700;
    onHop({ kind: "first_token" });
    onHop({ kind: "first_token" });
    clock = 2100;
    onHop({
      kind: "step",
      step: hopStep({ index: 0, ms: 650, costUsd: 0.001, step: { usage: { inputTokens: 10 } } }),
    });

    expect(streamed).toEqual(trace.events);
    expect(streamed.map((event) => [event.kind, event.t])).toEqual([
      ["jev.start", 0],
      ["jev.end", 400],
      ["hop.start", 450],
      ["hop.first_token", 700],
      ["hop.step", 1100],
    ]);
    expect(streamed[2]).toMatchObject({ hopId: "hop-1", operation: "respond", model: "anthropic/claude-haiku-4.5" });
    for (const event of streamed) expect(JevStageTraceEventSchema.safeParse(event).success).toBe(true);
  });
});
