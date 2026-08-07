import { describe, expect, test } from "bun:test";

import { deriveDrawerChatTurns, clampTurnIndex } from "@/lib/rabbit-holes/drawer-turns";

describe("deriveDrawerChatTurns", () => {
  test("pairs user messages with the next assistant reply", () => {
    const turns = deriveDrawerChatTurns([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Hi" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "Again" }] },
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0].user.id).toBe("u1");
    expect(turns[0].assistant?.id).toBe("a1");
    expect(turns[1].assistant).toBeNull();
  });

  test("does not derive turns from path metadata", () => {
    const turns = deriveDrawerChatTurns([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Q" }] },
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0].assistant).toBeNull();
  });
});

describe("clampTurnIndex", () => {
  test("clamps within bounds", () => {
    expect(clampTurnIndex(-1, 3)).toBe(0);
    expect(clampTurnIndex(5, 3)).toBe(2);
    expect(clampTurnIndex(1, 0)).toBe(0);
  });
});
