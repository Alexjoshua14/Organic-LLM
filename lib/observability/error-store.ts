import "server-only";

import type { ServerErrorLogSource, ServerErrorReport } from "./server-error";

import { redis } from "@/lib/redis/redis";

const KEY = "organic:server-errors:v1";

/** Ring-buffer depth. Enough to cover a debugging session, small enough to stay cheap. */
export const SERVER_ERROR_LOG_LIMIT = 100;

/** Reports expire after a week so the key never grows unbounded. */
const TTL_SECONDS = 7 * 24 * 3600;

/**
 * Per-instance fallback for local dev (and any deploy without Upstash). Serverless
 * instances don't share it, so Redis is the useful path in production.
 */
const memoryLog: ServerErrorReport[] = [];

export type { ServerErrorLogSource };

export function isErrorStoreRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Best-effort persistence. Diagnostics must never mask the failure they describe, so
 * every Redis error here is swallowed.
 */
export async function recordServerErrorReport(report: ServerErrorReport): Promise<void> {
  memoryLog.unshift(report);
  if (memoryLog.length > SERVER_ERROR_LOG_LIMIT) {
    memoryLog.length = SERVER_ERROR_LOG_LIMIT;
  }

  if (!isErrorStoreRedisConfigured()) return;

  try {
    await redis.lpush(KEY, JSON.stringify(report));
    await redis.ltrim(KEY, 0, SERVER_ERROR_LOG_LIMIT - 1);
    await redis.expire(KEY, TTL_SECONDS);
  } catch {
    /* diagnostics are best-effort */
  }
}

/** Upstash deserializes JSON values automatically, so entries arrive as objects or strings. */
function coerceReport(entry: unknown): ServerErrorReport | null {
  if (typeof entry === "string") {
    try {
      return JSON.parse(entry) as ServerErrorReport;
    } catch {
      return null;
    }
  }
  if (entry && typeof entry === "object") {
    return entry as ServerErrorReport;
  }

  return null;
}

export async function listServerErrorReports(
  limit = SERVER_ERROR_LOG_LIMIT
): Promise<{ reports: ServerErrorReport[]; source: ServerErrorLogSource }> {
  const capped = Math.max(1, Math.min(limit, SERVER_ERROR_LOG_LIMIT));

  if (isErrorStoreRedisConfigured()) {
    try {
      const raw = await redis.lrange<unknown>(KEY, 0, capped - 1);
      const reports = (raw ?? [])
        .map(coerceReport)
        .filter((r): r is ServerErrorReport => r !== null);

      return { reports, source: "redis" };
    } catch {
      /* fall through to the in-process log */
    }
  }

  return { reports: memoryLog.slice(0, capped), source: "memory" };
}

export async function clearServerErrorReports(): Promise<void> {
  memoryLog.length = 0;

  if (!isErrorStoreRedisConfigured()) return;

  try {
    await redis.del(KEY);
  } catch {
    /* best-effort */
  }
}
