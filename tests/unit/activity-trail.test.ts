import type { UIMessage } from "ai";

import { describe, expect, test } from "bun:test";

import {
  createActivityTrailTimer,
  formatThoughtDuration,
  groupActivityTrails,
  reasoningHeadline,
} from "@/lib/chat/activity-trail";
import { trailLiveHeadline, trailSummaryLabel } from "@/lib/chat/activity-trail-summary";

const webSearch = (toolCallId: string, urls: string[]) => ({
  type: "dynamic-tool" as const,
  toolName: "web_search",
  toolCallId,
  state: "output-available" as const,
  input: { query: "q" },
  output: { results: urls.map((url) => ({ url, title: url })) },
});

describe("groupActivityTrails", () => {
  test("coalesces reasoning around process tools into one trail before the answer", () => {
    const parts: UIMessage["parts"] = [
      { type: "reasoning", text: "Checking the changelog.", state: "done" },
      webSearch("s1", ["https://a.example", "https://b.example"]),
      { type: "step-start" },
      { type: "reasoning", text: "Comparing entries.", state: "done" },
      { type: "text", text: "Answer.", state: "done" },
    ];
    const { trailsByStartIndex, foldedIndices, lastSegmentIsTrail } = groupActivityTrails(parts);

    expect([...trailsByStartIndex.keys()]).toEqual([0]);
    expect(trailsByStartIndex.get(0)?.memberIndices).toEqual([0, 1, 3]);
    expect(trailsByStartIndex.get(0)?.steps.map((step) => step.kind)).toEqual([
      "reasoning",
      "tool",
      "reasoning",
    ]);
    expect([...foldedIndices]).toEqual([1, 3]);
    expect(lastSegmentIsTrail).toBe(false);
  });

  test("product tools and visible text split trails; blank text does not", () => {
    const parts: UIMessage["parts"] = [
      { type: "reasoning", text: "Plan.", state: "done" },
      { type: "text", text: "  ", state: "done" },
      { type: "reasoning", text: "More.", state: "done" },
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "g1",
        state: "output-available",
        input: {},
        output: {},
      },
      { type: "reasoning", text: "", state: "streaming" },
    ];
    const { trailsByStartIndex, lastSegmentIsTrail } = groupActivityTrails(parts);

    expect([...trailsByStartIndex.values()].map((t) => [t.ordinal, t.memberIndices])).toEqual([
      [0, [0, 2]],
      [1, [4]],
    ]);
    expect(trailsByStartIndex.get(0)?.steps).toEqual([
      { kind: "reasoning", text: "Plan.\n\nMore.", isStreaming: false, partIndex: 0 },
    ]);
    expect(trailsByStartIndex.get(4)?.hasStreamingMember).toBe(true);
    expect(lastSegmentIsTrail).toBe(true);
  });
});

describe("createActivityTrailTimer", () => {
  test("times each trail from its step start to the first breaker or the end", () => {
    let clock = 0;
    const observe = createActivityTrailTimer(() => clock);

    observe({ type: "start-step" });
    clock = 2_000;
    expect(observe({ type: "reasoning-start" })).toBeUndefined();
    clock = 3_000;
    expect(observe({ type: "tool-call", toolName: "web_search" })).toBeUndefined();
    expect(observe({ type: "text-delta", text: "  " })).toBeUndefined();
    clock = 9_000;
    expect(observe({ type: "text-delta", text: "Answer" })).toEqual({
      activityDurationsMs: { "0": 9_000 },
    });
    clock = 10_000;
    observe({ type: "reasoning-start" });
    clock = 12_500;
    expect(observe({ type: "finish" })).toEqual({ activityDurationsMs: { "1": 2_500 } });
  });

  test("a product tool closes the trail", () => {
    let clock = 0;
    const observe = createActivityTrailTimer(() => clock);

    observe({ type: "reasoning-start" });
    clock = 1_000;
    expect(observe({ type: "tool-input-start", toolName: "render_gen_ui" })).toEqual({
      activityDurationsMs: { "0": 1_000 },
    });
  });
});

describe("trail labels", () => {
  test("combines thought time with unique searched sources", () => {
    const parts: UIMessage["parts"] = [
      { type: "reasoning", text: "Thinking.", state: "done" },
      webSearch("s1", ["https://a.example", "https://b.example"]),
      webSearch("s2", ["https://b.example", "https://c.example"]),
    ];
    const trail = groupActivityTrails(parts).trailsByStartIndex.get(0)!;

    expect(trailSummaryLabel(parts, trail, 14_200)).toBe("Thought for 14s · searched 3 sources");
    expect(trailSummaryLabel(parts, trail, null)).toBe("Searched 3 sources");
  });

  test("tool-only trails describe the tool; empty reasoning has no label", () => {
    const memory: UIMessage["parts"] = [
      {
        type: "dynamic-tool",
        toolName: "search_memories",
        toolCallId: "m1",
        state: "output-available",
        input: {},
        output: {},
      },
    ];
    const empty: UIMessage["parts"] = [{ type: "reasoning", text: "", state: "done" }];

    expect(
      trailSummaryLabel(memory, groupActivityTrails(memory).trailsByStartIndex.get(0)!, 3_000)
    ).toBe("Checked memories");
    expect(
      trailSummaryLabel(empty, groupActivityTrails(empty).trailsByStartIndex.get(0)!, null)
    ).toBeNull();
    expect(
      trailSummaryLabel(empty, groupActivityTrails(empty).trailsByStartIndex.get(0)!, 4_000)
    ).toBe("Thought for 4s");
  });

  test("formats durations", () => {
    expect(formatThoughtDuration(200)).toBe("Thought for 1s");
    expect(formatThoughtDuration(14_400)).toBe("Thought for 14s");
    expect(formatThoughtDuration(125_000)).toBe("Thought for 2m 5s");
    expect(formatThoughtDuration(120_000)).toBe("Thought for 2m");
  });

  test("live headline follows the latest complete heading or the in-flight tool", () => {
    expect(reasoningHeadline("**Reading the changelog**\n\nDetails.\n\n**Compar")).toBe(
      "Reading the changelog"
    );
    expect(reasoningHeadline("Looking at eve releases. Still going")).toBe(
      "Looking at eve releases."
    );
    expect(reasoningHeadline("First check. Then the second one. And a thi")).toBe(
      "Then the second one."
    );
    expect(reasoningHeadline("Still writing the first")).toBeNull();

    const parts: UIMessage["parts"] = [
      { type: "reasoning", text: "**Planning**", state: "done" },
      {
        type: "dynamic-tool",
        toolName: "web_search",
        toolCallId: "s1",
        state: "input-available",
        input: {},
      },
    ];
    const trail = groupActivityTrails(parts).trailsByStartIndex.get(0)!;

    expect(trailLiveHeadline(trail, (name) => `Using ${name}`)).toBe("Using web_search");
  });
});
