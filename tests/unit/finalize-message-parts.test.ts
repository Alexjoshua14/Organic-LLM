import type { UIMessage } from "ai";

import { describe, expect, test } from "bun:test";

import { finalizeStreamingParts } from "@/lib/chat/finalize-message-parts";

describe("finalizeStreamingParts", () => {
  test("closes text and reasoning cut off mid-stream, leaving other parts untouched", () => {
    const message: UIMessage = {
      id: "m1",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Half a thought", state: "streaming" },
        { type: "step-start" },
        { type: "text", text: "Partial", state: "streaming" },
        {
          type: "dynamic-tool",
          toolName: "web_search",
          toolCallId: "tc",
          state: "input-streaming",
          input: {},
        },
      ],
    };

    expect(finalizeStreamingParts(message).parts).toEqual([
      { type: "reasoning", text: "Half a thought", state: "done" },
      { type: "step-start" },
      { type: "text", text: "Partial", state: "done" },
      message.parts[3],
    ]);
  });

  test("returns the same message when nothing is streaming", () => {
    const message: UIMessage = {
      id: "m2",
      role: "assistant",
      parts: [{ type: "text", text: "Done", state: "done" }],
    };

    expect(finalizeStreamingParts(message)).toBe(message);
  });
});
