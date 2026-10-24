import { beforeEach, describe, expect, mock, test } from "bun:test";

import { MockSupabaseClient, createTestMessages } from "../helpers/mock-supabase";

mock.module("server-only", () => ({}));

/**
 * `getThreadScreen` is a Server Action — callable from any client with any arguments — so the
 * property that matters most is that a wrong owner gets nothing, having read nothing.
 */

const OWNER = "owner-a";
const OTHER = "owner-b";
const now = new Date().toISOString();

function thread(id: string, title: string | null, ownerId = OWNER) {
  return { id, owner_id: ownerId, title, created_at: now, updated_at: now };
}

describe("getThreadScreen", () => {
  let client: MockSupabaseClient;
  let getThreadScreen: typeof import("@/data/supabase/chat").getThreadScreen;

  beforeEach(async () => {
    process.env.ORGANIC_LLM_ROOT_SECRET = "test-root-secret";
    process.env.ORGANIC_LLM_ACTIVE_KEY_ID = "k1";
    client = new MockSupabaseClient();
    client.insertThreads([thread("chat-1", "Espresso grinders"), thread("chat-2", null)]);
    client.insertMessages(createTestMessages("chat-1", 10));
    client.insertThreadSummaries([
      { thread_id: "chat-1", summary_text: "Comparing burr grinders." },
    ]);

    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.resolve(client),
    }));

    ({ getThreadScreen } = await import("@/data/supabase/chat"));
  });

  test("returns the title, the latest messages oldest-first, and the summary", async () => {
    const result = await getThreadScreen("chat-1", { expectedOwnerId: OWNER, messageLimit: 3 });

    expect(result.error).toBeNull();
    expect(result.data!.title).toBe("Espresso grinders");
    expect(result.data!.messages.map((m) => m.id)).toEqual([
      "chat-1-msg-8",
      "chat-1-msg-9",
      "chat-1-msg-10",
    ]);
    expect(result.data!.summary).toBe("Comparing burr grinders.");
  });

  test("one thread-row read, then messages and summary — three queries in all", async () => {
    await getThreadScreen("chat-1", { expectedOwnerId: OWNER, messageLimit: 3 });

    expect([...client.queriedTables].sort()).toEqual(["messages", "thread_summaries", "threads"]);
  });

  test("a different owner gets not-owner, and no message or summary is ever read", async () => {
    const result = await getThreadScreen("chat-1", { expectedOwnerId: OTHER, messageLimit: 3 });

    expect(result).toEqual({ data: null, error: "not-owner" });
    expect(client.queriedTables).toEqual(["threads"]);
  });

  test("an unknown thread is not-found, again without touching content", async () => {
    const result = await getThreadScreen("missing", { expectedOwnerId: OWNER, messageLimit: 3 });

    expect(result).toEqual({ data: null, error: "not-found" });
    expect(client.queriedTables).toEqual(["threads"]);
  });

  test("an untitled thread with no messages or summary yet is still a screen", async () => {
    const result = await getThreadScreen("chat-2", { expectedOwnerId: OWNER, messageLimit: 3 });

    expect(result.data).toEqual({ title: null, messages: [], summary: null });
  });
});
