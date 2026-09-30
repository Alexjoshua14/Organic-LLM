import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";

import { ensureModelMessagesEndWithUserTurn } from "@/lib/llm/summarizer-message-format";

describe("ensureModelMessagesEndWithUserTurn", () => {
  test("appends a user cue when history ends on assistant", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];

    const result = ensureModelMessagesEndWithUserTurn(messages);

    expect(result).toHaveLength(3);
    expect(result[2]?.role).toBe("user");
    expect(typeof result[2]?.content === "string" && result[2].content.length).toBeGreaterThan(0);
  });

  test("is idempotent when history already ends on user", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "thanks" },
    ];

    expect(ensureModelMessagesEndWithUserTurn(messages)).toEqual(messages);
  });

  test("returns a user cue for empty history", () => {
    const result = ensureModelMessagesEndWithUserTurn([]);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("user");
  });
});
