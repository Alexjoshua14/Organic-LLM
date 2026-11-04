import type { UIMessage } from "ai";

import { describe, expect, test } from "bun:test";

import { groupReasoningParts } from "@/lib/chat/reasoning-parts";

describe("groupReasoningParts", () => {
  test("merges consecutive reasoning parts into one run at the first index", () => {
    const parts: UIMessage["parts"] = [
      { type: "reasoning", text: "First.", state: "done" },
      { type: "reasoning", text: "  ", state: "done" },
      { type: "reasoning", text: "Second.", state: "streaming" },
      { type: "text", text: "Answer", state: "streaming" },
    ];
    const { runsByStartIndex } = groupReasoningParts(parts);

    expect([...runsByStartIndex.entries()]).toEqual([
      [0, { text: "First.\n\nSecond.", isStreaming: true }],
    ]);
  });

  test("non-reasoning parts split runs", () => {
    const parts: UIMessage["parts"] = [
      { type: "reasoning", text: "Plan.", state: "done" },
      { type: "step-start" },
      { type: "reasoning", text: "", state: "done" },
    ];
    const { runsByStartIndex } = groupReasoningParts(parts);

    expect(runsByStartIndex.get(0)).toEqual({ text: "Plan.", isStreaming: false });
    expect(runsByStartIndex.get(2)).toEqual({ text: "", isStreaming: false });
  });
});
