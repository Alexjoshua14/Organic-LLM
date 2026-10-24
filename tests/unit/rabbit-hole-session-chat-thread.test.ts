import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

/** Fake `rabbit_hole_sessions` row: `null` means the session has not been persisted. */
let sessionRow: { chat_thread_id: string | null } | null = null;

function sessionsTable() {
  let claimId: string | null = null;
  let onlyIfUnlinked = false;

  const query = {
    select: () => query,
    eq: () => query,
    update: (payload: { chat_thread_id: string }) => {
      claimId = payload.chat_thread_id;

      return query;
    },
    is: () => {
      onlyIfUnlinked = true;

      return query;
    },
    maybeSingle: async () => {
      if (claimId === null) {
        return { data: sessionRow ? { ...sessionRow, root_question: "Q" } : null, error: null };
      }
      // Conditional update: only the first claimant links its thread.
      if (!sessionRow || (onlyIfUnlinked && sessionRow.chat_thread_id !== null)) {
        return { data: null, error: null };
      }
      sessionRow.chat_thread_id = claimId;

      return { data: { chat_thread_id: claimId }, error: null };
    },
  };

  return query;
}

let createdCount = 0;
let releaseCreates: () => void = () => {};
let createsGate: Promise<void> = Promise.resolve();
let createsToHold = 0;

const mockCreateChat = mock(async () => {
  createdCount += 1;
  const id = `thread-${createdCount}`;

  if (createdCount === createsToHold) releaseCreates();
  await createsGate;

  return { data: id, error: null };
});
const mockDeleteChat = mock(async () => ({ ok: true, error: null }));
const mockUpdateThreadRouting = mock(async () => ({ ok: true, error: null }));

// Snapshots of what the preload installed (chat-store and supabase/server are preload stubs;
// the real chat data module is kept on `__realChat`). Restored in afterAll.
const realChatStore = { ...(await import("@/lib/chat/chat-store")) };
const realChatData = { ...globalThis.__realChat };
const realSupabaseServer = { ...(await import("@/lib/supabase/server")) };

mock.module("@/lib/chat/chat-store", () => ({ ...realChatStore, createChat: mockCreateChat }));
mock.module("@/data/supabase/chat", () => ({
  ...realChatData,
  deleteChat: mockDeleteChat,
  updateThreadRouting: mockUpdateThreadRouting,
}));
mock.module("@/lib/supabase/server", () => ({
  ...realSupabaseServer,
  supabaseServer: async () => ({ from: () => sessionsTable() }),
}));

const { ensureRabbitHoleChatThread } = await import(
  "@/lib/rabbit-holes/session-chat-thread?session-chat-thread-test"
);

afterAll(() => {
  mock.module("@/lib/chat/chat-store", () => realChatStore);
  mock.module("@/data/supabase/chat", () => realChatData);
  mock.module("@/lib/supabase/server", () => realSupabaseServer);
});

describe("ensureRabbitHoleChatThread", () => {
  beforeEach(() => {
    sessionRow = { chat_thread_id: null };
    createdCount = 0;
    createsToHold = 0;
    createsGate = Promise.resolve();
    mockCreateChat.mockClear();
    mockDeleteChat.mockClear();
    mockUpdateThreadRouting.mockClear();
  });

  test("returns the linked thread without creating another", async () => {
    sessionRow = { chat_thread_id: "linked" };

    const res = await ensureRabbitHoleChatThread(SESSION_ID);

    expect(res).toEqual({ ok: true, threadId: "linked" });
    expect(mockCreateChat).not.toHaveBeenCalled();
  });

  test("concurrent bootstraps converge on one thread and discard the loser", async () => {
    // Hold both creates until both requests have read the session as unlinked.
    createsToHold = 2;
    createsGate = new Promise((resolve) => (releaseCreates = resolve));

    const [first, second] = await Promise.all([
      ensureRabbitHoleChatThread(SESSION_ID),
      ensureRabbitHoleChatThread(SESSION_ID),
    ]);

    expect(first).toEqual(second);
    expect(first.ok && first.threadId).toBe(sessionRow?.chat_thread_id ?? "");
    expect(mockCreateChat).toHaveBeenCalledTimes(2);
    expect(mockDeleteChat).toHaveBeenCalledTimes(1);
    expect(mockDeleteChat.mock.calls[0]?.[0]).not.toBe(sessionRow?.chat_thread_id);
    // Only the winner is routed into the sidebar.
    expect(mockUpdateThreadRouting).toHaveBeenCalledTimes(1);
    expect(mockUpdateThreadRouting.mock.calls[0]?.[0]).toBe(sessionRow?.chat_thread_id);
  });

  test("still creates a usable thread when the session row does not exist yet", async () => {
    sessionRow = null;

    const res = await ensureRabbitHoleChatThread(SESSION_ID);

    expect(res).toEqual({ ok: true, threadId: "thread-1" });
    expect(mockUpdateThreadRouting).toHaveBeenCalledTimes(1);
    expect(mockDeleteChat).not.toHaveBeenCalled();
  });
});
