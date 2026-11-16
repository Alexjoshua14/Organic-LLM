import { createHash } from "node:crypto";

/**
 * Prompt-cache request options for multi-turn chat (COA-554).
 *
 * Anthropic caches only when a request carries cache markers; the AI Gateway adds them when
 * `caching: "auto"` is set. Providers that cache implicitly (OpenAI, Google, DeepSeek) are left
 * untouched by the Gateway, so the option is safe for every chat model.
 *
 * Use it only on calls that continue a conversation. A one-shot call (title, rewrite, routing)
 * would pay the cache-write premium for an entry nothing reads.
 */
export const GATEWAY_PROMPT_CACHING = { caching: "auto" } as const;

const SESSION_AFFINITY_HEADER = "x-session-affinity";

/**
 * Opaque, stable value for one thread. The Gateway forwards it so related requests can stay on
 * the provider that holds the cache. It is a hash, so no user or thread id leaves the server.
 */
export function promptCacheSessionId(args: { userId: string; chatId: string }): string {
  return createHash("sha256")
    .update(`organic-llm:chat-session:${args.userId}:${args.chatId}`)
    .digest("hex")
    .slice(0, 32);
}

/** Header to pass as `headers` on a chat `streamText` call. */
export function promptCacheSessionHeaders(args: {
  userId: string;
  chatId: string;
}): Record<string, string> {
  return { [SESSION_AFFINITY_HEADER]: promptCacheSessionId(args) };
}
