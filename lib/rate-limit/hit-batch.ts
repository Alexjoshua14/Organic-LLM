/**
 * Batched developer logs for rate-limit denies.
 *
 * Call {@link recordRateLimitHit} from limiter check functions. Inside
 * {@link runWithRateLimitHitBatch} (Arcadia context-effort phase), hits are
 * collected and logged once. Outside a batch, each deny logs immediately.
 */
import { AsyncLocalStorage } from "async_hooks";

import { createLogger } from "@/lib/logger";
import {
  catalogEntryByError,
  catalogEntryById,
  type RateLimitCatalogEntry,
} from "@/lib/rate-limit/catalog";

const logger = createLogger("lib/rate-limit/hit-batch.ts");

export type RateLimitHit = {
  limiter: string;
  prefix?: string;
  cap?: number;
  window?: string;
  remaining?: number;
  limit?: number;
  reset?: number;
  error: string;
  where: string;
};

export type RateLimitLimiterSummary = {
  limiter: string;
  prefix?: string;
  cap?: number;
  window?: string;
  hits: number;
  remaining?: number;
  reset?: number;
  msUntilReset?: number;
  error: string;
  why?: string;
};

export type RateLimitHitSummary = {
  totalDenies: number;
  limiterCount: number;
  byLimiter: RateLimitLimiterSummary[];
};

type BatchStore = { hits: RateLimitHit[] };

const storage = new AsyncLocalStorage<BatchStore>();

export function classifyRateLimitError(
  error: string | null | undefined
): RateLimitCatalogEntry | undefined {
  if (!error?.trim()) return undefined;

  return catalogEntryByError(error);
}

export function recordRateLimitHit(hit: RateLimitHit): void {
  const catalog = catalogEntryById(hit.limiter) ?? classifyRateLimitError(hit.error);
  const enriched: RateLimitHit = {
    ...hit,
    prefix: hit.prefix ?? catalog?.prefix,
    cap: hit.cap ?? catalog?.cap,
    window: hit.window ?? catalog?.window,
  };
  const batch = storage.getStore();

  if (batch) {
    batch.hits.push(enriched);

    return;
  }

  logger.warn("rateLimitDenied", `${enriched.limiter} denied (${enriched.where})`, {
    ...summarizeRateLimitHits([enriched]),
    where: enriched.where,
  });
}

export function peekRateLimitHitBatch(): RateLimitHit[] {
  return storage.getStore()?.hits.slice() ?? [];
}

export async function runWithRateLimitHitBatch<T>(
  fn: () => Promise<T>
): Promise<{ value: T; hits: RateLimitHit[] }> {
  const batch: BatchStore = { hits: [] };

  const value = await storage.run(batch, fn);

  return { value, hits: batch.hits };
}

export function summarizeRateLimitHits(
  hits: RateLimitHit[],
  nowMs: number = Date.now()
): RateLimitHitSummary {
  const grouped = new Map<string, RateLimitHit[]>();

  for (const hit of hits) {
    const key = hit.limiter || classifyRateLimitError(hit.error)?.id || "unknown";
    const list = grouped.get(key);

    if (list) list.push(hit);
    else grouped.set(key, [hit]);
  }

  const byLimiter: RateLimitLimiterSummary[] = [];

  for (const [limiter, group] of grouped) {
    const catalog = catalogEntryById(limiter) ?? classifyRateLimitError(group[0]?.error);
    const remainings = group
      .map((hit) => hit.remaining)
      .filter((value): value is number => typeof value === "number");
    const resets = group
      .map((hit) => hit.reset)
      .filter((value): value is number => typeof value === "number");
    const reset = resets.length > 0 ? Math.max(...resets) : undefined;

    byLimiter.push({
      limiter,
      prefix: group[0]?.prefix ?? catalog?.prefix,
      cap: group[0]?.cap ?? catalog?.cap,
      window: group[0]?.window ?? catalog?.window,
      hits: group.length,
      remaining: remainings.length > 0 ? Math.min(...remainings) : undefined,
      reset,
      msUntilReset: reset !== undefined ? Math.max(0, reset - nowMs) : undefined,
      error: group[0]?.error ?? catalog?.error ?? "rate limited",
      why: catalog?.why,
    });
  }

  byLimiter.sort((a, b) => b.hits - a.hits || a.limiter.localeCompare(b.limiter));

  return {
    totalDenies: hits.length,
    limiterCount: byLimiter.length,
    byLimiter,
  };
}

/** One warn for a whole phase. No-op when there were no denies. */
export function logBatchedRateLimitHits(
  functionName: string,
  message: string,
  extra: Record<string, unknown>,
  hits: RateLimitHit[]
): void {
  if (hits.length === 0) return;

  const summary = summarizeRateLimitHits(hits);
  const names = summary.byLimiter.map((row) => `${row.limiter}×${row.hits}`).join(", ");

  logger.warn(functionName, `${message} (${names})`, {
    ...extra,
    rateLimits: summary,
  });
}
