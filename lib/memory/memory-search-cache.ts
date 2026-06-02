/**
 * In-process **L1 cache** for Mem0 semantic search results.
 *
 * **Why:** Repeated or multi-query Arcadia retrieval can hit the same normalized query; this
 * avoids redundant Mem0 round-trips within the TTL window. Payloads are **encrypted** per user
 * using the same helpers as message storage (`memory.cache.semantic_search` field).
 *
 * **Entry point:** {@link searchMemoriesWithL1Cache} — prefer this over calling
 * {@link searchMemoriesForUser} directly when latency matters and staleness (~45s) is acceptable.
 */
import "server-only";

import { createHash } from "crypto";

import { createLogger } from "@/lib/logger";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto/message-encryption";
import type { EncryptionContext } from "@/lib/crypto/message-encryption";
import { SearchResult as SearchResultSchema, type SearchResultType } from "@/lib/schemas/memory";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import type { Result } from "@/types";

import { createTtsV2AudioCache } from "@/lib/tts/tts-v2-audio-cache";

const logger = createLogger("lib/memory/memory-search-cache.ts");

/** Synthetic thread id passed into encryption context (not a real chat thread). */
const MEMORY_CACHE_THREAD_ID = "memory-search-l1-cache";

/** LRU-ish cap for cached queries per process. */
const CACHE_MAX_ENTRIES = 96;
/** Stale search results are dropped after this window (milliseconds). */
const CACHE_TTL_MS = 45_000;

const cache = createTtsV2AudioCache(CACHE_MAX_ENTRIES, CACHE_TTL_MS);

function encryptionContextForUser(userId: string): EncryptionContext {
  return {
    userId,
    threadId: MEMORY_CACHE_THREAD_ID,
    fieldName: "memory.cache.semantic_search",
  };
}

/** Collapses whitespace and case so trivial spelling differences still hit cache. */
function normalizeQueryForKey(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Stable key: user + sha256(normalized query + limit). */
function buildCacheKey(userId: string, query: string, limit: number): string {
  const normalized = normalizeQueryForKey(query);
  const hash = createHash("sha256").update(`${normalized}:${limit}`).digest("hex").slice(0, 32);

  return `${userId}:${hash}`;
}

/**
 * Synchronous cache read: decrypt + schema-validate. Returns `null` on miss or corrupt entry.
 */
export function tryGetCachedMemorySearch(
  userId: string,
  query: string,
  limit: number
): SearchResultType | null {
  if (!userId || !query.trim()) return null;

  const key = buildCacheKey(userId, query, limit);
  const entry = cache.get(key);

  if (!entry) return null;

  try {
    const plaintext = decryptFromStorage(entry.streamData, encryptionContextForUser(userId));
    const parsed = JSON.parse(plaintext) as unknown;
    const validated = SearchResultSchema.safeParse(parsed);

    if (!validated.success) {
      logger.warn("tryGetCachedMemorySearch", "Invalid cached payload; treating as miss");

      return null;
    }

    return validated.data;
  } catch (e) {
    logger.warn(
      "tryGetCachedMemorySearch",
      `Decrypt/parse failed: ${e instanceof Error ? e.message : String(e)}`
    );

    return null;
  }
}

/** Encrypts a successful Mem0 payload and stores it under {@link buildCacheKey}. */
export function setCachedMemorySearch(
  userId: string,
  query: string,
  limit: number,
  data: SearchResultType
): void {
  if (!userId || !query.trim()) return;

  try {
    const payload = JSON.stringify({
      results: data.results,
      relations: data.relations ?? [],
    });
    const ciphertext = encryptForStorage(payload, encryptionContextForUser(userId));

    cache.set(buildCacheKey(userId, query, limit), {
      streamData: ciphertext,
      timestamp: Date.now(),
    });
  } catch (e) {
    logger.warn(
      "setCachedMemorySearch",
      `Encrypt failed (cache skip): ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/** Timing + hit flag for logs and Arcadia pipeline diagnostics. */
export type MemorySearchWithCacheMetrics = {
  cacheHit: boolean;
  memorySearchMs: number;
};

/**
 * Mem0 search with optional in-process L1 hit (still applies {@link searchMemoriesForUser} rate limits on miss).
 *
 * @param userId - Supabase user id (Mem0 user key).
 * @param query - Raw search string (cache key includes normalized form + limit).
 * @param limit - Mem0 `limit` option; must match across calls for the same cache slot.
 * @returns Validated Mem0 result plus metrics; errors pass through from operations layer.
 */
export async function searchMemoriesWithL1Cache(
  userId: string,
  query: string,
  limit: number
): Promise<{ result: Result<SearchResultType, string>; metrics: MemorySearchWithCacheMetrics }> {
  const t0 = performance.now();
  const cached = tryGetCachedMemorySearch(userId, query, limit);

  if (cached) {
    return {
      result: { data: cached, error: null },
      metrics: { cacheHit: true, memorySearchMs: performance.now() - t0 },
    };
  }

  const result = await searchMemoriesForUser(userId, query, { limit });

  if (!result.error && result.data) {
    setCachedMemorySearch(userId, query, limit, result.data);
  }

  return {
    result,
    metrics: { cacheHit: false, memorySearchMs: performance.now() - t0 },
  };
}
