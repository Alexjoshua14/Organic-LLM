import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { lastAssistantPlaintext } from "@/app/sandbox/prototypes/memory-ingest/_lib/memory-ingest-messages";

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
