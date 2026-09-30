import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  lastAssistantGenUIParts,
  lastAssistantPlaintext,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/memory-ingest-messages";

describe("lastAssistantPlaintext", () => {
  test("returns last assistant text part", () => {
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hello there." }] },
    ];
    expect(lastAssistantPlaintext(messages)).toBe("Hello there.");
  });

  test("ignores trailing user after assistant", () => {
    const messages: UIMessage[] = [
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Saved." }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "next" }] },
    ];
    expect(lastAssistantPlaintext(messages)).toBe("Saved.");
  });
});

const answerCardOutput = {
  block: {
    type: "answer-card",
    version: 1,
    title: "Draft memory",
    tldr: "Filing summary",
    keyPoints: ["point"],
  },
};

function genUIPart(state: string, output?: unknown) {
  return {
    type: "tool-render_gen_ui",
    toolCallId: "call-1",
    state,
    input: {},
    ...(output !== undefined ? { output } : {}),
  } as unknown as NonNullable<UIMessage["parts"]>[number];
}

describe("lastAssistantGenUIParts", () => {
  test("extracts completed render_gen_ui output from the last assistant message", () => {
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "file this" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Review before I commit:" },
          genUIPart("output-available", answerCardOutput),
        ],
      },
    ];

    const parts = lastAssistantGenUIParts(messages);

    expect(parts).toHaveLength(1);
    expect(parts[0]?.messageId).toBe("a1");
    expect(parts[0]?.partIndex).toBe(1);
    expect(parts[0]?.output).toEqual(answerCardOutput);
  });

  test("only surfaces the latest assistant turn — older blocks do not linger", () => {
    const messages: UIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [genUIPart("output-available", answerCardOutput)],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: "yes" }] },
      { id: "a2", role: "assistant", parts: [{ type: "text", text: "Filed." }] },
    ];

    expect(lastAssistantGenUIParts(messages)).toHaveLength(0);
  });

  test("ignores in-flight tool parts and other tools", () => {
    const messages: UIMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          genUIPart("input-streaming"),
          {
            type: "tool-commit_memory",
            toolCallId: "call-2",
            state: "output-available",
            input: {},
            output: { success: true },
          } as unknown as NonNullable<UIMessage["parts"]>[number],
        ],
      },
    ];

    expect(lastAssistantGenUIParts(messages)).toHaveLength(0);
  });

  test("returns empty for no assistant messages", () => {
    const messages: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
    ];

    expect(lastAssistantGenUIParts(messages)).toHaveLength(0);
  });
});
