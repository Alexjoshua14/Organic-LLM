import { describe, test, expect, mock, beforeEach } from "bun:test";

mock.module("@/lib/rate-limit/llm", () => ({
  checkLlmMessageLimit: async () => ({ success: true, remaining: 10 }),
}));

const { createAionHandler } = await import("@/lib/api/aion-handler");

import { createMockStreamText } from "../helpers/mock-stream-text";
import {
  createTestChatRequest,
  createTestContext,
  createTestUIMessage,
} from "../helpers/test-fixtures";

function createJsonRequest(body: unknown, signal?: AbortSignal) {
  return new Request("http://test/api/ai/aion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

describe("POST /api/ai/aion (integration)", () => {
  const mockAuth = mock(async () => ({ userId: "clerk_test_user" }));
  const mockGetSupabaseUserId = mock(async () => ({
    data: "sb_test_user",
    error: null,
  }));

  const mockGetContext = mock(async () => ({
    data: createTestContext(),
    error: null,
  }));

  const mockSaveChat = mock(async () => ({ ok: true, error: null }));
  const mockDeleteChatMessage = mock(async () => ({ ok: true, error: null }));

  const mockEnsureChatHasTitle = mock(async () => ({ ok: true, error: null }));
  const mockUpdateChatSummary = mock(async () => ({ ok: true, error: null }));

  const mockAddLatestMessagesToMemory = mock(async () => ({
    data: { results: [], relations: [] },
    error: null,
  }));

  const mockCreateMemorySearchTool = mock((userId: string) => ({
    type: "tool",
    name: "search_memories",
    userId,
  }));

  let streamTextMock: ReturnType<typeof createMockStreamText>;

  const makeHandler = () =>
    createAionHandler({
      auth: mockAuth,
      getSupabaseUserId: mockGetSupabaseUserId,
      getContext: mockGetContext as any,
      saveChat: mockSaveChat as any,
      deleteChatMessage: mockDeleteChatMessage as any,
      streamText: streamTextMock.streamText as any,
      ensureChatHasTitle: mockEnsureChatHasTitle as any,
      updateChatSummary: mockUpdateChatSummary as any,
      addLatestMessagesToMemory: mockAddLatestMessagesToMemory as any,
      createMemorySearchTool: mockCreateMemorySearchTool as any,
    });

  beforeEach(() => {
    mockAuth.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockGetContext.mockClear();
    mockSaveChat.mockClear();
    mockDeleteChatMessage.mockClear();
    mockEnsureChatHasTitle.mockClear();
    mockUpdateChatSummary.mockClear();
    mockAddLatestMessagesToMemory.mockClear();
    mockCreateMemorySearchTool.mockClear();
  });

  test("returns 400 for invalid body", async () => {
    streamTextMock = createMockStreamText();
    const handler = makeHandler();

    const res = await handler(createJsonRequest({}));
    expect(res.status).toBe(400);
  });

  test("returns 401 when user is not authenticated", async () => {
    streamTextMock = createMockStreamText();
    const handler = makeHandler();
    mockAuth.mockResolvedValueOnce(null);

    const res = await handler(createJsonRequest(createTestChatRequest()));
    expect(res.status).toBe(401);
  });

  test("returns 404 when user not found in supabase", async () => {
    streamTextMock = createMockStreamText();
    const handler = makeHandler();
    mockGetSupabaseUserId.mockResolvedValueOnce({
      data: null,
      error: new Error("not found"),
    });

    const res = await handler(createJsonRequest(createTestChatRequest()));
    expect(res.status).toBe(404);
  });

  test("saves user message optimistically when role is user", async () => {
    streamTextMock = createMockStreamText({ onFinishMessages: [] });
    const handler = makeHandler();
    const reqBody = createTestChatRequest({
      message: createTestUIMessage({ role: "user" }),
    });

    const res = await handler(createJsonRequest(reqBody));
    await res.text(); // consume to drive stream execution

    expect(res.status).toBe(200);
    expect(mockSaveChat).toHaveBeenCalled();
  });

  test("calls getContext with expected parameters", async () => {
    streamTextMock = createMockStreamText({ onFinishMessages: [] });
    const handler = makeHandler();

    const reqBody = createTestChatRequest({
      memory: true,
      message: createTestUIMessage({ role: "user" }),
    });

    const res = await handler(createJsonRequest(reqBody));
    await res.text();

    expect(res.status).toBe(200);
    expect(mockGetContext).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 30,
        memoryEnabled: true,
        persistedSchemasEnabled: true,
      }),
    );
  });

  test("invokes streamText with model, system, messages and tools", async () => {
    streamTextMock = createMockStreamText({ onFinishMessages: [] });
    const handler = makeHandler();

    const reqBody = createTestChatRequest({
      memory: true,
      message: createTestUIMessage({ role: "user" }),
    });

    const res = await handler(createJsonRequest(reqBody));
    await res.text();

    expect(res.status).toBe(200);
    expect(streamTextMock.calls).toHaveLength(1);

    const call = streamTextMock.calls[0]!;
    expect(typeof call.model).toBe("string");
    expect(call.model.length).toBeGreaterThan(0);
    expect(typeof call.system).toBe("string");
    expect(call.tools).toEqual(
      expect.objectContaining({
        search_memories: expect.anything(),
        show_memories: expect.anything(),
        set_state_archetype: expect.anything(),
        view_archetype: expect.anything(),
      }),
    );
  });

  test("when memory is enabled, onFinish triggers addLatestMessagesToMemory", async () => {
    const userMsg = createTestUIMessage({ role: "user" });
    const assistantMsg = createTestUIMessage({ role: "assistant" });

    streamTextMock = createMockStreamText({
      onFinishMessages: [userMsg, assistantMsg],
    });
    const handler = makeHandler();

    const reqBody = createTestChatRequest({
      memory: true,
      message: userMsg,
    });

    const res = await handler(createJsonRequest(reqBody));
    await res.text();

    expect(res.status).toBe(200);
    expect(mockAddLatestMessagesToMemory).toHaveBeenCalled();
  });

  test("when memory is disabled, onFinish does not call addLatestMessagesToMemory", async () => {
    const userMsg = createTestUIMessage({ role: "user" });
    const assistantMsg = createTestUIMessage({ role: "assistant" });

    streamTextMock = createMockStreamText({
      onFinishMessages: [userMsg, assistantMsg],
    });
    const handler = makeHandler();

    const reqBody = createTestChatRequest({
      memory: false,
      message: userMsg,
    });

    const res = await handler(createJsonRequest(reqBody));
    await res.text();

    expect(res.status).toBe(200);
    expect(mockAddLatestMessagesToMemory).not.toHaveBeenCalled();
  });

  test("when aborted, deletes the optimistic user message", async () => {
    const ac = new AbortController();
    ac.abort();

    streamTextMock = createMockStreamText({
      isAborted: true,
      onFinishMessages: [],
    });
    const handler = makeHandler();

    const reqBody = createTestChatRequest({
      message: createTestUIMessage({ role: "user" }),
    });

    const res = await handler(createJsonRequest(reqBody, ac.signal));
    await res.text();

    expect(res.status).toBe(200);
    expect(mockDeleteChatMessage).toHaveBeenCalled();
  });
});

