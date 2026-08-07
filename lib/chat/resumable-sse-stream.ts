import { generateId, consumeStream } from "ai";
import { after } from "next/server";
import { createClient } from "redis";
import { createResumableStreamContext } from "resumable-stream";

import { saveChat } from "@/lib/chat/chat-store";
import type { Logger } from "@/lib/logger";

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

/** Shared resumable-stream context with Redis error handlers attached. */
export function createChatResumableStreamContext() {
  const url = redisUrl();

  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return createResumableStreamContext({
    waitUntil: after,
    publisher: createSafeRedisClient(url),
    subscriber: createSafeRedisClient(url),
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
    const streamContext = createChatResumableStreamContext();

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
