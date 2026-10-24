import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import type { SpeakRealtimeSessionRecord } from "@/lib/rate-limit/speak-realtime";
import { persistSpeakVoiceTurns, type PersistSpeakTurnsDeps } from "@/lib/speak/persist-voice-turns";
import type { SpeakVoiceTurn } from "@/lib/speak/voice-turns";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const turn = (n: number, role: SpeakVoiceTurn["role"], at: number): SpeakVoiceTurn => ({
  id: uuid(n),
  role,
  text: `${role} ${n}`,
  at,
});

const baseSession: SpeakRealtimeSessionRecord = {
  sessionId: "sess",
  userId: "me",
  model: "gpt-realtime-2.1-mini",
  threadId: "thread",
  modalities: { text: true, genUi: false, web: false },
  memoryEnabled: true,
  startedAt: 0,
  lastMeteredAt: 0,
  expiresAt: 1_000_000,
  minutesUsed: 0,
  costUsd: 0,
  status: "active",
};

type Calls = {
  upserts: Array<{ chatId: string; messages: UIMessage[] }>;
  memoryAdds: Array<{ userId: string; messages: UIMessage[]; chatId?: string }>;
  titles: string[];
  summaries: string[];
};

function makeDeps(
  session: SpeakRealtimeSessionRecord | null,
  overrides: Partial<PersistSpeakTurnsDeps> = {}
): { deps: PersistSpeakTurnsDeps; calls: Calls } {
  const calls: Calls = { upserts: [], memoryAdds: [], titles: [], summaries: [] };
  const deps: PersistSpeakTurnsDeps = {
    getSpeakRealtimeSession: async () => session,
    upsertMessages: async (params) => {
      calls.upserts.push(params);

      return { ok: true, error: null };
    },
    ensureChatHasTitle: async (id) => {
      calls.titles.push(id);

      return { data: "Title", error: null };
    },
    updateChatSummary: async (id) => {
      calls.summaries.push(id);

      return { data: "Summary", error: null };
    },
    addLatestMessagesToMemoryForUser: async (userId, messages, chatId) => {
      calls.memoryAdds.push({ userId, messages, chatId });

      return { data: { results: [] }, error: null };
    },
    ...overrides,
  };

  return { deps, calls };
}

describe("persistSpeakVoiceTurns guards", () => {
  test("404 when the session is unknown", async () => {
    const { deps } = makeDeps(null);
    const res = await persistSpeakVoiceTurns({ userId: "me", sessionId: "x", turns: [] }, deps);

    expect(res).toEqual({ ok: false, error: "Session not found", status: 404 });
  });

  test("403 when the session belongs to another user", async () => {
    const { deps, calls } = makeDeps({ ...baseSession, userId: "other" });
    const res = await persistSpeakVoiceTurns(
      { userId: "me", sessionId: "sess", turns: [turn(1, "user", 1)] },
      deps
    );

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.status).toBe(403);
    expect(calls.upserts).toEqual([]);
  });

  test("409 when the session has no thread", async () => {
    const { deps } = makeDeps({ ...baseSession, threadId: null });
    const res = await persistSpeakVoiceTurns(
      { userId: "me", sessionId: "sess", turns: [turn(1, "user", 1)] },
      deps
    );

    expect(res.ok === false && res.status).toBe(409);
  });

  test("closed sessions still accept the final flush", async () => {
    const { deps, calls } = makeDeps({ ...baseSession, status: "closed" });
    const res = await persistSpeakVoiceTurns(
      { userId: "me", sessionId: "sess", turns: [turn(1, "user", 1)], final: true },
      deps
    );

    expect(res.ok).toBe(true);
    expect(calls.upserts.length).toBe(1);
  });
});

describe("persistSpeakVoiceTurns writes", () => {
  test("upserts one row per turn in `at` order with the speak envelope", async () => {
    const { deps, calls } = makeDeps(baseSession);
    const res = await persistSpeakVoiceTurns(
      {
        userId: "me",
        sessionId: "sess",
        // Assistant transcript arrived first; the user's utterance is older.
        turns: [turn(2, "assistant", 20), turn(1, "user", 10)],
      },
      deps
    );

    expect(res.ok).toBe(true);
    expect(res.ok && res.persisted).toBe(2);
    expect(calls.upserts.map((u) => u.messages[0]?.id)).toEqual([uuid(1), uuid(2)]);
    expect(calls.upserts.every((u) => u.chatId === "thread" && u.messages.length === 1)).toBe(true);
    expect(calls.upserts[0]?.messages[0]?.metadata).toEqual({
      source: "speak-realtime",
      sessionId: "sess",
      at: 10,
    });
  });

  test("stops at the first failed upsert and reports the count", async () => {
    let n = 0;
    const { deps, calls } = makeDeps(baseSession, {
      upsertMessages: async (params) => {
        calls.upserts.push(params);
        n += 1;

        return n === 2
          ? { ok: false, error: new Error("db") }
          : { ok: true, error: null };
      },
    });

    const res = await persistSpeakVoiceTurns(
      {
        userId: "me",
        sessionId: "sess",
        turns: [turn(1, "user", 1), turn(2, "assistant", 2), turn(3, "user", 3)],
      },
      deps
    );

    expect(res.ok && res.persisted).toBe(1);
    expect(calls.upserts.length).toBe(2);
  });
});

describe("persistSpeakVoiceTurns postProcess", () => {
  test("ingests complete exchanges into memory, then refreshes title and summary", async () => {
    const { deps, calls } = makeDeps(baseSession);
    const res = await persistSpeakVoiceTurns(
      {
        userId: "me",
        sessionId: "sess",
        turns: [turn(1, "user", 1), turn(2, "assistant", 2), turn(3, "user", 3)],
      },
      deps
    );

    if (!res.ok) throw new Error("expected ok");

    await res.postProcess();

    expect(calls.memoryAdds.length).toBe(1);
    expect(calls.memoryAdds[0]?.userId).toBe("me");
    expect(calls.memoryAdds[0]?.chatId).toBe("thread");
    expect(calls.memoryAdds[0]?.messages.map((m) => m.id)).toEqual([uuid(1), uuid(2)]);
    expect(calls.titles).toEqual(["thread"]);
    expect(calls.summaries).toEqual(["thread"]);
  });

  test("skips memory when the session opted out, and the summary when nothing new completed", async () => {
    const { deps, calls } = makeDeps({ ...baseSession, memoryEnabled: false });
    const res = await persistSpeakVoiceTurns(
      { userId: "me", sessionId: "sess", turns: [turn(1, "user", 1)] },
      deps
    );

    if (!res.ok) throw new Error("expected ok");

    await res.postProcess();

    expect(calls.memoryAdds).toEqual([]);
    expect(calls.titles).toEqual(["thread"]);
    expect(calls.summaries).toEqual([]);
  });

  test("the final flush refreshes the summary even for a lone trailing turn", async () => {
    const { deps, calls } = makeDeps(baseSession);
    const res = await persistSpeakVoiceTurns(
      { userId: "me", sessionId: "sess", turns: [turn(1, "user", 1)], final: true },
      deps
    );

    if (!res.ok) throw new Error("expected ok");

    await res.postProcess();

    expect(calls.summaries).toEqual(["thread"]);
  });

  test("does nothing when no turn was persisted", async () => {
    const { deps, calls } = makeDeps(baseSession, {
      upsertMessages: async () => ({ ok: false, error: new Error("db") }),
    });
    const res = await persistSpeakVoiceTurns(
      { userId: "me", sessionId: "sess", turns: [turn(1, "user", 1), turn(2, "assistant", 2)] },
      deps
    );

    if (!res.ok) throw new Error("expected ok");

    await res.postProcess();

    expect(calls.memoryAdds).toEqual([]);
    expect(calls.titles).toEqual([]);
  });
});
