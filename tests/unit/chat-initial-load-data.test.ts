import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { UIMessage } from "ai";
import * as supabase from "@/lib/supabase/server";

import { encryptForStorage } from "@/lib/crypto/message-encryption";

const THREAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const thread = {
  id: THREAD,
  owner_id: OWNER,
  active_stream_id: "stream-test",
  arcadia_multitask_view: false,
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z",
};
const message: UIMessage = {
  id: "message-test",
  role: "user",
  parts: [{ type: "text", text: "Private message" }],
};
let threadRead: () => Promise<{ data: typeof thread | null; error: { message: string } | null }>;
let messageRows: Array<Record<string, unknown>>;
let messageError: { message: string } | null;
let started: string[];
let restore: () => void;
const getClient = mock(async () => ({
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      single: () => {
        started.push(table);
        return threadRead();
      },
      order: () => {
        started.push(table);
        return Promise.resolve({ data: messageRows, error: messageError });
      },
    };

    return query;
  },
}));

beforeEach(() => {
  process.env.ORGANIC_LLM_ROOT_SECRET = "test-root-secret";
  process.env.ORGANIC_LLM_ACTIVE_KEY_ID = "k1";
  started = [];
  messageRows = [];
  messageError = null;
  threadRead = async () => ({ data: thread, error: null });
  getClient.mockClear();
  const clientSpy = spyOn(supabase, "supabaseServer").mockImplementation(getClient as never);

  restore = () => clientSpy.mockRestore();
});

afterEach(() => restore());

function encryptedRow(ownerId = OWNER) {
  return {
    id: message.id,
    thread_id: THREAD,
    role: message.role,
    schema_kind: "ui_message",
    schema_version: 1,
    content: encryptForStorage(JSON.stringify(message), {
      userId: ownerId,
      threadId: THREAD,
      fieldName: "messages.content",
    }),
  };
}

describe("chat initial database load", () => {
  test("message reading starts before the thread read finishes", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof threadRead>>) => void;

    threadRead = () =>
      new Promise((done) => {
        resolve = done;
      });
    const pending = globalThis.__realChat.loadChat(THREAD);

    await Promise.resolve();
    expect(started).toEqual(["threads", "messages"]);
    resolve({ data: thread, error: null });
    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.messages).toEqual([]);
    expect(result.data?.thread.active_stream_id).toBe("stream-test");
  });

  test("encrypted messages use the loaded owner without another client or owner read", async () => {
    messageRows = [encryptedRow()];
    const result = await globalThis.__realChat.loadChat(THREAD);

    expect(result.data?.messages).toEqual([message]);
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(started).toEqual(["threads", "messages"]);
  });

  test("a denied thread read cannot return message content", async () => {
    threadRead = async () => ({ data: null, error: { message: "Thread unavailable" } });
    messageRows = [encryptedRow("other-owner")];
    const result = await globalThis.__realChat.loadChat(THREAD);

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Thread unavailable");
  });

  test("a failed message read cannot return a partial successful chat", async () => {
    messageError = { message: "Messages unavailable" };
    const result = await globalThis.__realChat.loadChat(THREAD);

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Messages unavailable");
  });

  test("messages encrypted for another owner still fail authentication", async () => {
    messageRows = [encryptedRow("other-owner")];
    await expect(globalThis.__realChat.loadChat(THREAD)).rejects.toThrow();
  });
});
