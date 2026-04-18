import { createHash } from "node:crypto";

import { redis } from "@/lib/redis/redis";

const PREFIX = "tabtitle:v1";
const DATA = (k: string) => `${PREFIX}:d:${k}`;
const LRU_Z = `${PREFIX}:lru`;
const BYTES_KEY = `${PREFIX}:bytes`;

/** ~5 MiB total payload footprint (keys + values + ZSET bookkeeping, approximated). */
export const TAB_TITLE_CACHE_MAX_BYTES = 5 * 1024 * 1024;

/** Entries expire after 7 days even if not evicted by size. */
export const TAB_TITLE_CACHE_TTL_SEC = 7 * 24 * 3600;

/** Estimated Redis key name + ZSET member overhead per entry (conservative). */
const ENTRY_OVERHEAD = 112;

const MAX_EVICTION_STEPS = 512;

export function isTabTitleRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function tabTitleCacheDigest(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u0000"), "utf8").digest("hex");
}

function entryByteSizeForTitle(title: string): number {
  return Buffer.byteLength(title, "utf8") + ENTRY_OVERHEAD;
}

export async function getCachedTabTitlePrimary(cacheKey: string): Promise<string | null> {
  if (!isTabTitleRedisConfigured()) {
    return null;
  }
  try {
    const raw = await redis.get(DATA(cacheKey));

    if (typeof raw !== "string" || !raw) {
      return null;
    }
    await redis.zadd(LRU_Z, { score: Date.now(), member: cacheKey });

    return raw;
  } catch {
    return null;
  }
}

async function evictUntilUnderBudget(): Promise<void> {
  for (let i = 0; i < MAX_EVICTION_STEPS; i += 1) {
    const totalRaw = await redis.get(BYTES_KEY);
    const total = typeof totalRaw === "string" ? Number.parseInt(totalRaw, 10) : 0;

    if (!Number.isFinite(total) || total <= TAB_TITLE_CACHE_MAX_BYTES) {
      return;
    }

    const oldest = (await redis.zrange<string>(LRU_Z, 0, 0)) as unknown;
    const victim =
      Array.isArray(oldest) && oldest.length > 0 && typeof oldest[0] === "string"
        ? oldest[0]
        : null;

    if (!victim) {
      await redis.set(BYTES_KEY, "0");

      return;
    }

    const raw = await redis.get(DATA(victim));

    if (typeof raw !== "string") {
      await redis.zrem(LRU_Z, victim);
      continue;
    }

    const freed = entryByteSizeForTitle(raw);

    await redis.del(DATA(victim));
    await redis.zrem(LRU_Z, victim);
    const next = Math.max(0, total - freed);

    await redis.set(BYTES_KEY, String(next));
  }
}

export async function setCachedTabTitlePrimary(cacheKey: string, primary: string): Promise<void> {
  if (!isTabTitleRedisConfigured()) {
    return;
  }
  const t = primary.trim().slice(0, 56);

  if (!t) {
    return;
  }

  try {
    const prevRaw = await redis.get(DATA(cacheKey));
    const prevBytes = typeof prevRaw === "string" ? entryByteSizeForTitle(prevRaw) : 0;
    const newBytes = entryByteSizeForTitle(t);
    const delta = newBytes - prevBytes;

    await redis.set(DATA(cacheKey), t, { ex: TAB_TITLE_CACHE_TTL_SEC });
    await redis.zadd(LRU_Z, { score: Date.now(), member: cacheKey });

    if (delta !== 0) {
      await redis.incrby(BYTES_KEY, delta);
    }

    await evictUntilUnderBudget();
  } catch {
    /* ignore cache failures */
  }
}
