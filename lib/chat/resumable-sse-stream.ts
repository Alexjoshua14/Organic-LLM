import type { Logger } from "@/lib/logger";

import { generateId, consumeStream } from "ai";
import { after } from "next/server";
import { createClient } from "redis";
import { createResumableStreamContext } from "resumable-stream";

import { saveChat } from "@/lib/chat/chat-store";

const REDIS_CONNECT_TIMEOUT_MS = 5_000;

type RedisClients = {
  publisher: ReturnType<typeof createClient>;
  subscriber: ReturnType<typeof createClient>;
};
let redisClients: { url: string; promise: Promise<RedisClients> } | undefined;

function redisUrl(): string | undefined {
  return process.env.REDIS_URL ?? process.env.KV_URL;
}

function createSafeRedisClient(url: string) {
  const client = createClient({ url });

  client.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);

    console.warn(`[resumable-sse-stream] Redis client error: ${message}`);
  });

  return client;
}

async function connectRedisClients(url: string): Promise<RedisClients> {
  const publisher = createSafeRedisClient(url);
  const subscriber = createSafeRedisClient(url);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    // resumable-stream does not connect custom clients. Bound initial setup so
    // an unavailable Redis instance can fall back to consuming the SSE stream.
    await Promise.race([
      Promise.all([publisher.connect(), subscriber.connect()]),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Stream persistence connection timed out")),
          REDIS_CONNECT_TIMEOUT_MS
        );
      }),
    ]);

    return { publisher, subscriber };
  } catch (error) {
    await Promise.allSettled([publisher.disconnect(), subscriber.disconnect()]);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Request-scoped context backed by shared, connected Redis clients. */
export async function createChatResumableStreamContext() {
  const url = redisUrl();

  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  if (!redisClients || redisClients.url !== url) {
    const entry = { url, promise: connectRedisClients(url) };

    redisClients = entry;
    entry.promise.catch(() => {
      if (redisClients === entry) redisClients = undefined;
    });
  }

  const { publisher, subscriber } = await redisClients.promise;

  return createResumableStreamContext({
    waitUntil: after,
    publisher,
    subscriber,
  });
}

export type ConsumeChatSseStreamParams = {
  stream: ReadableStream<string>;
  chatId: string;
  logger: Logger;
};

/**
 * Persists the outgoing SSE stream for resume, or falls back to a direct consume
 * when Redis is unavailable or the resumable wrapper fails to initialize.
 */
export async function consumeChatSseStream({
  stream,
  chatId,
  logger,
}: ConsumeChatSseStreamParams): Promise<void> {
  const url = redisUrl();

  if (!url) {
    logger.warn("consumeSseStream", "REDIS_URL unset; using non-resumable consumeStream");
    await consumeStream({ stream });

    return;
  }

  const streamId = generateId();

  try {
    const streamContext = await createChatResumableStreamContext();

    await streamContext.createNewResumableStream(streamId, () => stream);
    await saveChat({ chatId, activeStreamId: streamId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error(
      "consumeSseStream",
      "Resumable stream setup failed; falling back to consumeStream",
      { err: message }
    );
    await consumeStream({ stream });
  }
}
