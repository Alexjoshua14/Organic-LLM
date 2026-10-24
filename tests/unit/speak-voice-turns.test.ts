import { describe, expect, test } from "bun:test";

import {
  completeExchanges,
  SPEAK_TURN_SOURCE,
  SpeakVoiceTurnSchema,
  sortVoiceTurns,
  voiceTurnToUIMessage,
  type SpeakVoiceTurn,
} from "@/lib/speak/voice-turns";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const turn = (n: number, role: SpeakVoiceTurn["role"], at: number, text = `t${n}`): SpeakVoiceTurn => ({
  id: uuid(n),
  role,
  text,
  at,
});

describe("SpeakVoiceTurnSchema", () => {
  test("rejects blank text and non-uuid ids", () => {
    expect(SpeakVoiceTurnSchema.safeParse(turn(1, "user", 1, "   ")).success).toBe(false);
    expect(SpeakVoiceTurnSchema.safeParse({ ...turn(1, "user", 1), id: "nope" }).success).toBe(false);
  });

  test("trims text", () => {
    const parsed = SpeakVoiceTurnSchema.parse(turn(1, "user", 1, "  hi  "));

    expect(parsed.text).toBe("hi");
  });
});

describe("voiceTurnToUIMessage", () => {
  test("uses the chat ui_message envelope and stamps the source", () => {
    const message = voiceTurnToUIMessage(turn(7, "assistant", 42, "Sure."), "sess_1");

    expect(message.id).toBe(uuid(7));
    expect(message.role).toBe("assistant");
    expect(message.parts).toEqual([{ type: "text", text: "Sure." }]);
    expect(message.metadata).toEqual({ source: SPEAK_TURN_SOURCE, sessionId: "sess_1", at: 42 });
  });
});

describe("sortVoiceTurns", () => {
  test("orders by `at` and keeps insertion order for ties", () => {
    const sorted = sortVoiceTurns([turn(1, "assistant", 20), turn(2, "user", 10), turn(3, "user", 20)]);

    expect(sorted.map((t) => t.id)).toEqual([uuid(2), uuid(1), uuid(3)]);
  });
});

describe("completeExchanges", () => {
  test("drops a leading assistant turn and a trailing user turn", () => {
    const turns = [
      turn(1, "assistant", 1),
      turn(2, "user", 2),
      turn(3, "assistant", 3),
      turn(4, "user", 4),
    ];

    expect(completeExchanges(turns).map((t) => t.id)).toEqual([uuid(2), uuid(3)]);
  });

  test("returns nothing without a user→assistant pair", () => {
    expect(completeExchanges([turn(1, "user", 1)])).toEqual([]);
    expect(completeExchanges([turn(1, "assistant", 1), turn(2, "user", 2)])).toEqual([]);
    expect(completeExchanges([])).toEqual([]);
  });
});
