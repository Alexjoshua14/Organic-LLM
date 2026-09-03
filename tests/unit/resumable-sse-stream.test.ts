import { afterEach, describe, expect, mock, test } from "bun:test";

const consumeStreamMock = mock(async () => {});
const saveChatMock = mock(async () => ({ data: null, error: null }));
const createNewResumableStreamMock = mock(async () => new ReadableStream());
const createResumableStreamContextMock = mock(() => ({
  createNewResumableStream: createNewResumableStreamMock,
}));

const realAi = await import("ai");

mock.module("ai", () => ({
  ...realAi,
  generateId: () => "stream-test-id",
  consumeStream: consumeStreamMock,
}));

mock.module("next/server", () => ({
  after: (promise: Promise<unknown>) => promise,
}));

mock.module("@/lib/chat/chat-store", () => ({
  saveChat: saveChatMock,
}));

mock.module("resumable-stream", () => ({
  createResumableStreamContext: createResumableStreamContextMock,
}));

mock.module("redis", () => ({
  createClient: () => ({
    on: () => {},
  }),
}));

const { consumeChatSseStream } = await import("@/lib/chat/resumable-sse-stream");
const { createLogger } = await import("@/lib/logger");

const logger = createLogger("tests/unit/resumable-sse-stream.test.ts");

describe("consumeChatSseStream", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    consumeStreamMock.mockClear();
    saveChatMock.mockClear();
    createNewResumableStreamMock.mockClear();
    createResumableStreamContextMock.mockClear();

    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  test("falls back to consumeStream when REDIS_URL is unset", async () => {
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;

    const stream = new ReadableStream<string>();

    await consumeChatSseStream({ stream, chatId: "chat-1", logger });

    expect(consumeStreamMock).toHaveBeenCalledTimes(1);
    expect(createResumableStreamContextMock).not.toHaveBeenCalled();
    expect(saveChatMock).not.toHaveBeenCalled();
  });

  test("persists active stream id when resumable setup succeeds", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    const stream = new ReadableStream<string>();

    await consumeChatSseStream({ stream, chatId: "chat-2", logger });

    expect(createResumableStreamContextMock).toHaveBeenCalledTimes(1);
    expect(createNewResumableStreamMock).toHaveBeenCalledTimes(1);
    expect(saveChatMock).toHaveBeenCalledWith({
      chatId: "chat-2",
      activeStreamId: "stream-test-id",
    });
    expect(consumeStreamMock).not.toHaveBeenCalled();
  });

  test("falls back to consumeStream when resumable setup throws", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    createNewResumableStreamMock.mockImplementationOnce(async () => {
      throw new Error("read ECONNRESET");
    });

    const stream = new ReadableStream<string>();

    await consumeChatSseStream({ stream, chatId: "chat-3", logger });

    expect(consumeStreamMock).toHaveBeenCalledTimes(1);
    expect(saveChatMock).not.toHaveBeenCalled();
  });
});
