import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { Chat as SdkChat } from "@ai-sdk/react";
import { MockLanguageModelV4 } from "ai/test";
import * as ai from "ai";
import {
  createUIMessageStreamResponse,
  DefaultChatTransport,
  type UIMessage,
  type UIMessageChunk,
  type ToolSet,
} from "ai";
import * as clerk from "@clerk/nextjs/server";
import * as nextServer from "next/server";
import * as redis from "redis";

import { mockModulePreservingReal } from "../helpers/module-mock";
import { createResumableRedisFixture } from "../helpers/resumable-redis";

import * as chatStore from "@/lib/chat/chat-store";
import * as chatData from "@/data/supabase/chat";
import * as chatGate from "@/lib/api/chat-llm-gate";
import * as mainContext from "@/lib/api/chat-turn-context";
import * as arcadiaContext from "@/lib/api/arcadia-chat-turn-context";
import * as contextBudget from "@/lib/api/main-chat-context-budget";
import * as chatTools from "@/lib/llm/compile-chat-tools";
import * as multitaskTurn from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import * as chatHelpers from "@/lib/llm/chat-helpers";
import * as usage from "@/lib/usage/track-llm-usage";
import * as llmLimits from "@/lib/rate-limit/llm";
import * as dispatch from "@/lib/message-queue/dispatch";
import { POST } from "@/app/api/chat/route";
import { GET } from "@/app/api/chat/[id]/stream/route";
import {
  finalizeContextBudget,
  getLatestContextBudgetFromMessages,
} from "@/lib/chat/context-budget";
import { summarizeContextMemories, type ContextMemoryReference } from "@/lib/chat/context-memory";
import { consumeChatSseStream } from "@/lib/chat/resumable-sse-stream";
import { createLogger } from "@/lib/logger";

const THREAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const logger = createLogger("tests/integration/chat-stream-resume-server.test");
const originalRedisUrl = process.env.REDIS_URL;
let restore: Array<() => void>;
let fixture: ReturnType<typeof createResumableRedisFixture>;
let activeStreamId: string | null;
let lifetimePromises: Promise<unknown>[];
let closeSources: Array<() => void>;
let sequence = 0;
const user: UIMessage = {
  id: "user-test",
  role: "user",
  parts: [{ type: "text", text: "Reconnect diagnostic" }],
};
const authMock = mock(async () => ({ userId: "clerk-test" as string | null }));
const readChatMock = mock(
  async (): Promise<Awaited<ReturnType<typeof chatStore.readChat>>> => ({
    data: {
      thread: {
        id: THREAD_ID,
        created_at: "2026-10-09T00:00:00.000Z",
        updated_at: "2026-10-09T00:00:00.000Z",
        active_stream_id: activeStreamId,
      },
      messages: [user],
    },
    error: null,
  })
);
const saveChatMock = mock(async (args: Parameters<typeof chatStore.saveChat>[0]) => {
  if (args.activeStreamId !== undefined) activeStreamId = args.activeStreamId;

  return { ok: true, error: null };
});

beforeEach(() => {
  fixture = createResumableRedisFixture();
  activeStreamId = null;
  lifetimePromises = [];
  closeSources = [];
  process.env.REDIS_URL = "redis://test.invalid:" + (6300 + ++sequence);
  authMock.mockClear();
  authMock.mockResolvedValue({ userId: "clerk-test" });
  readChatMock.mockClear();
  saveChatMock.mockClear();
  restore = [
    mockModulePreservingReal("@clerk/nextjs/server", clerk, {
      auth: authMock as unknown as typeof clerk.auth,
    }),
    mockModulePreservingReal("next/server", nextServer, {
      after: (work) => {
        if (typeof work !== "function") lifetimePromises.push(work);
      },
    }),
    mockModulePreservingReal("redis", redis, {
      createClient: fixture.createClient as unknown as typeof redis.createClient,
    }),
    mockModulePreservingReal("@/lib/chat/chat-store", chatStore, {
      readChat: readChatMock,
      saveChat: saveChatMock,
    }),
  ];
});

afterEach(async () => {
  for (const close of closeSources) close();
  await Promise.allSettled(lifetimePromises);
  for (const reset of restore.reverse()) reset();
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

function resumeRequest() {
  return GET(new Request("http://test/api/chat/" + THREAD_ID + "/stream"), {
    params: Promise.resolve({ id: THREAD_ID }),
  });
}

function text(chat: SdkChat) {
  return chat.messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.parts)
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function installPostFixture(options?: {
  model?: MockLanguageModelV4;
  tools?: ToolSet;
  memoryContext?: ContextMemoryReference[];
}) {
  let controller!: ReadableStreamDefaultController<LanguageModelV4StreamPart>;
  let finished = false;
  const model =
    options?.model ??
    new MockLanguageModelV4({
      doStream: {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(value) {
            controller = value;
          },
        }),
      },
    });
  const loadContext = async () => ({
    validatedMessages: [user],
    systemPromptForRequest: "Answer the diagnostic prompt.",
  });

  // Exercise the production POST, streamText, UI stream composition, and persistence.
  // Only external model, database, and post-processing boundaries are replaced.
  restore.push(
    mockModulePreservingReal("ai", ai, (real) => ({
      streamText: ((options) => real.streamText({ ...options, model })) as typeof ai.streamText,
    })),
    mockModulePreservingReal("@/data/supabase/chat", chatData, {
      getThreadHasTitle: async () => ({ data: true, error: null }),
      getThreadArcadiaStarterKey: async () => ({ data: null, error: null }),
      getMessageCount: async () => ({ data: 2, error: null }),
    }),
    mockModulePreservingReal("@/lib/api/chat-llm-gate", chatGate, {
      requireLlmChatActor: async () => ({
        data: { sbUserId: "owner-test", clerkUserId: "clerk-test" },
        error: null,
      }),
    }),
    mockModulePreservingReal("@/lib/api/chat-turn-context", mainContext, {
      loadMainChatTurnContext: loadContext,
    }),
    mockModulePreservingReal("@/lib/api/arcadia-chat-turn-context", arcadiaContext, {
      loadArcadiaChatTurnContext: loadContext,
    }),
    mockModulePreservingReal("@/lib/api/main-chat-context-budget", contextBudget, {
      buildBudgetFromAssembledTurn: async ({ modelId }) =>
        finalizeContextBudget({
          modelId,
          segments: [],
          contextMessageLimit: 10,
          packedMessageCount: 0,
          totalThreadMessages: 0,
          includesRollingSummary: false,
          memoryContext: options?.memoryContext ?? [],
          lastTurn: { inputTokens: 0, memoryTokens: 0, memoriesInjected: 0 },
          source: "server",
        }),
    }),
    mockModulePreservingReal("@/lib/llm/compile-chat-tools", chatTools, {
      compileChatTools: async () => ({ tools: options?.tools ?? {}, toolInstructions: "" }),
    }),
    mockModulePreservingReal(
      "@/lib/llm/subagents/orchestrator/prepare-multitask-turn",
      multitaskTurn,
      {
        prepareArcadiaMultitaskTurn: async () => ({
          role: "orchestrator",
          systemFragments: [],
          hasSubagentThreads: false,
        }),
      }
    ),
    mockModulePreservingReal("@/lib/llm/chat-helpers", chatHelpers, {
      updateChatSummary: async () => ({ data: "", error: null }),
    }),
    mockModulePreservingReal("@/lib/usage/track-llm-usage", usage, {
      trackLlmUsageEvent: async () => {},
    }),
    mockModulePreservingReal("@/lib/rate-limit/llm", llmLimits, {
      recordLlmTokenUsage: async () => {},
      recordLlmCost: async () => {},
    }),
    mockModulePreservingReal("@/lib/message-queue/dispatch", dispatch, {
      kickDispatchAfterStream: async () => {},
    })
  );

  const finish = () => {
    if (!controller) return;
    if (finished) return;
    finished = true;
    controller.enqueue({ type: "text-end", id: "answer" });
    controller.enqueue({
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
    });
    controller.close();
  };

  closeSources.push(finish);

  return { controller, finish };
}

describe("server-backed chat stream resumption", () => {
  test("memory tools update context and multi-call usage survives persistence and reload", async () => {
    let call = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        const first = call++ === 0;
        const parts: LanguageModelV4StreamPart[] = [
          { type: "stream-start", warnings: [] },
          ...(first
            ? [
                {
                  type: "tool-call" as const,
                  toolCallId: "memory-call",
                  toolName: "search_memories",
                  input: '{"query":"facts"}',
                },
              ]
            : [
                { type: "text-start" as const, id: "answer" },
                { type: "text-delta" as const, id: "answer", delta: "Recalled." },
                { type: "text-end" as const, id: "answer" },
              ]),
          {
            type: "finish",
            finishReason: { unified: first ? "tool-calls" : "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: first ? 100 : 150,
                noCache: first ? 40 : 50,
                cacheRead: first ? 60 : 100,
                cacheWrite: 0,
              },
              outputTokens: { total: first ? 10 : 30, text: first ? 10 : 30, reasoning: 0 },
            },
            providerMetadata: { gateway: { cost: first ? "0.001" : "0.002" } },
          },
        ];

        return {
          stream: new ReadableStream({
            start(controller) {
              parts.forEach((part) => controller.enqueue(part));
              controller.close();
            },
          }),
        };
      },
    });

    installPostFixture({
      model,
      memoryContext: [{ id: "a", messageId: user.id, source: "automatic" }],
      tools: {
        search_memories: ai.tool({
          inputSchema: ai.jsonSchema({
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          }),
          execute: async () => ({
            success: true,
            memories: [
              { id: "a", memory: "Already recalled" },
              { id: "b", memory: "New fact" },
            ],
            count: 99,
          }),
        }),
      },
    });

    const chat = new SdkChat({
      id: THREAD_ID,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        fetch: async () =>
          POST(
            new Request("http://test/api/chat", {
              method: "POST",
              body: JSON.stringify({ id: THREAD_ID, message: user, memory: false }),
            })
          ),
      }),
    });
    await chat.sendMessage(user);
    await Promise.all(lifetimePromises);

    const streamed = getLatestContextBudgetFromMessages(chat.messages)!;
    expect(call).toBe(2);
    expect(streamed.lastTurn?.usage).toEqual({
      inputTokens: 250,
      cachedInputTokens: 160,
      outputTokens: 40,
      costUsd: 0.003,
      costSource: "gateway",
      modelCalls: 2,
      complete: true,
    });
    expect(summarizeContextMemories(streamed.memoryContext ?? [])).toEqual({
      total: 2,
      automatic: 1,
      tools: 2,
      overlap: 1,
    });

    const saved = saveChatMock.mock.calls
      .flatMap(([args]) => args.messages ?? [])
      .filter((message) => message.role === "assistant");
    expect(saved).toHaveLength(1);
    expect(saved[0].parts.filter((part) => part.type === "data-context-budget")).toHaveLength(1);
    expect(getLatestContextBudgetFromMessages(saved)?.lastTurn?.usage).toEqual(
      streamed.lastTurn?.usage
    );
    expect(getLatestContextBudgetFromMessages(saved)?.memoryContext).toEqual(
      streamed.memoryContext
    );
  });

  test.each([
    ["Chat", undefined],
    ["Arcadia", "arcadia"],
  ] as const)(
    "production %s replay keeps context data and generated text in one persisted assistant message",
    async (_label, experience) => {
      const source = installPostFixture();
      const transport = () =>
        new DefaultChatTransport({
          api: "/api/chat",
          fetch: async (_url, options) =>
            options?.method === "POST"
              ? POST(
                  new Request("http://test/api/chat", {
                    method: "POST",
                    body: JSON.stringify({
                      id: THREAD_ID,
                      message: user,
                      memory: false,
                      experience,
                    }),
                  })
                )
              : resumeRequest(),
        });
      const first = new SdkChat({ id: THREAD_ID, transport: transport() });
      const firstRun = first.sendMessage(user);

      source.controller.enqueue({ type: "stream-start", warnings: [] });
      source.controller.enqueue({ type: "text-start", id: "answer" });
      source.controller.enqueue({ type: "text-delta", id: "answer", delta: "Before leaving. " });
      await waitFor(() => expect(text(first)).toBe("Before leaving. "));
      const assistantId = first.messages.at(-1)!.id;

      await first.stop();
      await firstRun;

      const returning = new SdkChat({ id: THREAD_ID, messages: [user], transport: transport() });
      const resumedRun = returning.resumeStream();

      await waitFor(() => expect(text(returning)).toBe("Before leaving. "));
      expect(returning.messages.map((message) => message.id)).toEqual([user.id, assistantId]);
      expect(
        returning.messages.at(-1)!.parts.some((part) => part.type === "data-context-budget")
      ).toBe(true);

      source.controller.enqueue({ type: "text-delta", id: "answer", delta: "After returning. " });
      await waitFor(() => expect(text(returning)).toBe("Before leaving. After returning. "));
      await returning.stop();
      await resumedRun;
      source.controller.enqueue({ type: "text-delta", id: "answer", delta: "While away again. " });
      const secondResume = returning.resumeStream();
      const finalText = "Before leaving. After returning. While away again. ";

      await waitFor(() => expect(text(returning)).toBe(finalText));
      expect(returning.messages.map((message) => message.id)).toEqual([user.id, assistantId]);
      expect(
        returning.messages.at(-1)!.parts.filter((part) => part.type === "data-context-budget")
      ).toHaveLength(1);
      source.finish();
      await secondResume;
      await Promise.all(lifetimePromises);
      expect(returning.messages.map((message) => message.id)).toEqual([user.id, assistantId]);
      const savedAssistant = saveChatMock.mock.calls
        .flatMap(([args]) => args.messages ?? [])
        .filter((message) => message.role === "assistant");

      expect(savedAssistant).toHaveLength(1);
      expect(savedAssistant[0].id).toBe(assistantId);
      expect(savedAssistant[0].parts).toContainEqual({
        type: "text",
        text: finalText,
        state: "done",
      });
    }
  );

  test("a new SDK client replays the real registered stream and receives new chunks after navigation", async () => {
    let controller!: ReadableStreamDefaultController<UIMessageChunk>;
    const source = new ReadableStream<UIMessageChunk>({
      start(value) {
        controller = value;
      },
    });
    let registration!: Promise<void>;
    const response = createUIMessageStreamResponse({
      stream: source,
      consumeSseStream: ({ stream }) => {
        registration = consumeChatSseStream({ stream, chatId: THREAD_ID, logger });

        return registration;
      },
    });

    await registration;
    expect(activeStreamId).toBeTruthy();
    expect(fixture.clients).toHaveLength(2);
    expect(fixture.clients.every((client) => client.isOpen)).toBe(true);

    const transport = () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (_url, options) => (options?.method === "POST" ? response : resumeRequest()),
      });
    const first = new SdkChat({ id: THREAD_ID, transport: transport() });
    const firstRun = first.sendMessage(user);

    controller.enqueue({ type: "start", messageId: "assistant-test" });
    controller.enqueue({ type: "text-start", id: "answer" });
    controller.enqueue({ type: "text-delta", id: "answer", delta: "Before leaving" });
    await waitFor(() => expect(text(first)).toBe("Before leaving"));
    await first.stop();
    await firstRun;

    controller.enqueue({ type: "text-delta", id: "answer", delta: ", generated while away" });
    const returning = new SdkChat({ id: THREAD_ID, messages: [user], transport: transport() });
    const resumedRun = returning.resumeStream();

    await waitFor(() => expect(text(returning)).toBe("Before leaving, generated while away"));
    expect(returning.status).toBe("streaming");
    expect(fixture.clients).toHaveLength(2); // Reconnect shares the established Redis connections.

    controller.enqueue({ type: "text-delta", id: "answer", delta: ", and after returning ✓" });
    await waitFor(() =>
      expect(text(returning)).toBe("Before leaving, generated while away, and after returning ✓")
    );
    expect(returning.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
    controller.enqueue({ type: "text-end", id: "answer" });
    controller.enqueue({ type: "finish", finishReason: "stop" });
    controller.close();
    await resumedRun;
    await Promise.all(lifetimePromises);
    expect(returning.status).toBe("ready");

    // Redis is DONE before stale database metadata necessarily gets cleared.
    const finished = await resumeRequest();

    expect(finished.status).toBe(204);
    expect(finished.headers.get("cache-control")).toBe("no-store");
  });

  test("inactive, expired, and finished streams return an uncached 204", async () => {
    const inactive = await resumeRequest();

    expect(inactive.status).toBe(204);
    expect(inactive.headers.get("cache-control")).toBe("no-store");
    expect(fixture.clients).toHaveLength(0);

    activeStreamId = "expired-test";
    const expired = await resumeRequest();

    expect(expired.status).toBe(204);
    expect(expired.headers.get("cache-control")).toBe("no-store");

    activeStreamId = "finished-test";
    fixture.values.set("resumable-stream:rs:sentinel:finished-test", "DONE");
    const finished = await resumeRequest();

    expect(finished.status).toBe(204);
    expect(finished.headers.get("cache-control")).toBe("no-store");
  });

  test("authentication and denied thread reads prevent Redis access", async () => {
    activeStreamId = "private-stream-test";
    authMock.mockResolvedValueOnce({ userId: null });
    expect((await resumeRequest()).status).toBe(401);
    expect(readChatMock).not.toHaveBeenCalled();
    readChatMock.mockResolvedValueOnce({ data: null, error: new Error("Denied") });
    expect((await resumeRequest()).status).toBe(500);
    expect(fixture.clients).toHaveLength(0);
  });

  test("failed connection setup closes both clients and retries on the next request", async () => {
    fixture.failConnections(new Error("Connection unavailable"));
    await consumeChatSseStream({
      stream: new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      }),
      chatId: THREAD_ID,
      logger,
    });
    expect(activeStreamId).toBeNull();
    expect(saveChatMock).not.toHaveBeenCalled();
    expect(fixture.clients).toHaveLength(2);
    expect(fixture.clients.every((client) => client.disconnects === 1)).toBe(true);

    fixture.failConnections(null);
    activeStreamId = "expired-test";
    expect((await resumeRequest()).status).toBe(204);
    expect(fixture.clients).toHaveLength(4);
    expect(fixture.clients.slice(2).every((client) => client.isOpen)).toBe(true);
  });
});
