import { describe, expect, test } from "bun:test";

import { ChatRequestSchema } from "@/lib/schemas/chat";
import { CHAT_STYLES, ChatStyleSchema } from "@/lib/chat/chat-style";
import { createTestUIMessage } from "../helpers/test-fixtures";

const baseBody = () => ({
  message: createTestUIMessage(),
  id: "11111111-1111-4111-8111-111111111111",
});

describe("ChatRequestSchema chatStyle", () => {
  test("accepts every style declared in CHAT_STYLES (no drift)", () => {
    for (const style of CHAT_STYLES) {
      const parsed = ChatRequestSchema.safeParse({ ...baseBody(), chatStyle: style.id });

      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.chatStyle).toBe(style.id);
    }
  });

  test("accepts the Remy style specifically (regression for validation_failed)", () => {
    const parsed = ChatRequestSchema.safeParse({ ...baseBody(), chatStyle: "remy" });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.chatStyle).toBe("remy");
  });

  test("drops unknown styles to undefined rather than failing the request", () => {
    const parsed = ChatRequestSchema.safeParse({ ...baseBody(), chatStyle: "nonsense" });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.chatStyle).toBeUndefined();
  });

  test("ChatStyleSchema enumerates exactly the CHAT_STYLES ids", () => {
    expect(ChatStyleSchema.options.slice().sort()).toEqual(
      CHAT_STYLES.map((s) => s.id).sort()
    );
  });
});
