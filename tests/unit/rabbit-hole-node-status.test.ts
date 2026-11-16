import { describe, expect, test } from "bun:test";

import { resolveRabbitHoleNodeStatus } from "@/lib/rabbit-holes/node-status";
import { SESSION_WORKING_STALE_MS } from "@/lib/sidebar/session-signal-timing";

const NOW = Date.parse("2026-11-13T12:00:00.000Z");
const recent = new Date(NOW - 30_000).toISOString();
const old = new Date(NOW - SESSION_WORKING_STALE_MS - 1_000).toISOString();

describe("resolveRabbitHoleNodeStatus", () => {
  test("this node generating reports its step, with key points once the article exists", () => {
    expect(
      resolveRabbitHoleNodeStatus(
        "n",
        { generating_node_id: "n", generation_step: "article", updated_at: recent },
        { key_takeaways: [] },
        NOW
      )
    ).toEqual({ state: "working", step: "article", keyPoints: [] });
    expect(
      resolveRabbitHoleNodeStatus(
        "n",
        { generating_node_id: "n", generation_step: "branch_suggestions", updated_at: recent },
        { key_takeaways: ["a", " ", 3] },
        NOW
      )
    ).toEqual({ state: "working", step: "branch_suggestions", keyPoints: ["a"] });
  });

  test("scheduling placeholders are not key points, so a failed node never reads as ready", () => {
    const placeholders = { key_takeaways: ["Generating…", "…", "…"] };

    expect(
      resolveRabbitHoleNodeStatus(
        "n",
        { generating_node_id: "n", generation_step: "article", updated_at: recent },
        placeholders,
        NOW
      )
    ).toEqual({ state: "working", step: "article", keyPoints: [] });
    expect(
      resolveRabbitHoleNodeStatus(
        "n",
        { generating_node_id: null, generation_step: null, updated_at: recent },
        placeholders,
        NOW
      )
    ).toEqual({ state: "unknown" });
  });

  test("a generation that has not moved past the sidebar's stale threshold is stalled", () => {
    expect(
      resolveRabbitHoleNodeStatus(
        "n",
        { generating_node_id: "n", generation_step: "article", updated_at: old },
        { key_takeaways: [] },
        NOW
      )
    ).toEqual({ state: "stalled" });
  });

  test("once generation moves on, key points mean ready; none means unknown", () => {
    const done = { generating_node_id: null, generation_step: null, updated_at: recent };

    expect(resolveRabbitHoleNodeStatus("n", done, { key_takeaways: ["a", "b"] }, NOW)).toEqual({
      state: "ready",
      keyPoints: ["a", "b"],
    });
    expect(resolveRabbitHoleNodeStatus("n", done, { key_takeaways: null }, NOW)).toEqual({
      state: "unknown",
    });
    // Another node of the same session generating means this one is finished.
    expect(
      resolveRabbitHoleNodeStatus(
        "n",
        { generating_node_id: "other", generation_step: "sources", updated_at: recent },
        { key_takeaways: ["a"] },
        NOW
      ).state
    ).toBe("ready");
  });
});
