import type { UIMessage } from "ai";
import type { RunBtwStreamParams } from "@/lib/api/run-btw-stream";

import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import * as chatData from "@/data/supabase/chat";
import * as llmGate from "@/lib/api/chat-llm-gate";
import { AUTO_CHAT_MODEL_ID, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";

import { mockModulePreservingReal } from "../helpers/module-mock";

const OWNER = "sb_owner";
const THREAD_ID = "00000000-0000-4000-8000-0000000000b7";

const streamCalls: RunBtwStreamParams[] = [];
let threadOwner = OWNER;

const threadMessages: UIMessage[] = [
  { id: "1", role: "user", parts: [{ type: "text", text: "Plan a week in Lisbon." }] },
  { id: "2", role: "assistant", parts: [{ type: "text", text: "Day one: Alfama." }] },
];

// Preserve every real export: Bun module mocks are process-wide and never revert on their own.
// Shared modules other route tests also mock (`ai`, `@/data/supabase/profiles`) are left alone:
// those tests import their routes statically and bind to whatever is registered first. The
// stream runner is mocked instead, and only non-admin models are used, so no admin check runs.
const restores = [
  mockModulePreservingReal("@/lib/api/chat-llm-gate", llmGate, {
    requireLlmChatActor: async () => ({
      data: { sbUserId: OWNER, clerkUserId: "clerk_owner" },
      error: null,
    }),
  }),
  mockModulePreservingReal("@/data/supabase/chat", chatData, {
    getThreadOwnerContext: (async () => ({
      data: { ownerId: threadOwner },
      error: null,
    })) as unknown as typeof chatData.getThreadOwnerContext,
    getConversationSummary: async () => ({ data: "Trip planning summary.", error: null }),
    getMessages: async () => ({ data: threadMessages, error: null }),
  }),
];

// Only the btw route imports this module, so a full stub cannot leak into other files.
mock.module("@/lib/api/run-btw-stream", () => ({
  runBtwStream: (params: RunBtwStreamParams) => {
    streamCalls.push(params);

    return new Response("stream");
  },
}));

afterAll(() => restores.forEach((restore) => restore()));

const { POST } = await import("@/app/api/chat/[id]/btw/route");

function post(body: unknown) {
  return POST(
    new Request(`http://test/api/chat/${THREAD_ID}/btw`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: THREAD_ID }) }
  );
}

beforeEach(() => {
  streamCalls.length = 0;
  threadOwner = OWNER;
});

describe("POST /api/chat/[id]/btw", () => {
  test("answers with the selected model over a compact snapshot and no tools", async () => {
    const model = ChatModels.find(
      (m) => !m.adminOnly && m.id !== DEFAULT_CHAT_MODEL.id && m.id !== AUTO_CHAT_MODEL_ID
    )!;
    const res = await post({
      messages: [{ role: "user", text: "Is Sintra a day trip?" }],
      model,
      effort: "low",
    });

    expect(res.status).toBe(200);
    expect(streamCalls).toHaveLength(1);
    const call = streamCalls[0]!;

    expect(call.modelId).toBe(model.id);
    expect(call.effort).toBe("low");
    expect(call.snapshotText).toContain("Trip planning summary.");
    expect(call.snapshotText).toContain("Assistant: Day one: Alfama.");
    expect(call.messages).toEqual([{ role: "user", content: "Is Sintra a day trip?" }]);
  });

  test("refuses a thread the caller does not own", async () => {
    threadOwner = "someone_else";
    const res = await post({ messages: [{ role: "user", text: "Peek?" }] });

    expect(res.status).toBe(403);
    expect(streamCalls).toHaveLength(0);
  });

  test("rejects a side thread that does not end with the user's question", async () => {
    const res = await post({
      messages: [
        { role: "user", text: "Q" },
        { role: "assistant", text: "A" },
      ],
    });

    expect(res.status).toBe(400);
  });
});
