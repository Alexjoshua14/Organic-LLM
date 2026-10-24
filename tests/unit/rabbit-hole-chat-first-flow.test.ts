import { describe, expect, test } from "bun:test";

import { deriveDrawerChatTurns } from "@/lib/rabbit-holes/drawer-turns";

describe("chat-first rabbit hole flow", () => {
  test("turn pairing does not imply article nodes exist", () => {
    const turns = deriveDrawerChatTurns([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Tell me about coral reefs" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "I can explore that — want me to open an article node?" }],
      },
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0].assistant?.parts[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("article node"),
    });
  });
});
