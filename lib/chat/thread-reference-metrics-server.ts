import "server-only";

import { after } from "next/server";
import { redis } from "@/lib/redis/redis";
import { type ThreadReferenceOperation } from "./thread-reference-metrics";

const CAPACITY = 512;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const keyFor = (operation: ThreadReferenceOperation) => `thread-reference-metrics:v1:${operation}`;
const operations: ThreadReferenceOperation[] = [
  "resolve",
  "cache-hit",
  "cache-miss",
  "clipboard-read",
  "clipboard-copy",
];

/** Queue bounded aggregate timing storage after the response. Values contain no identity or content. */
export function recordThreadReferenceMetric(
  operation: ThreadReferenceOperation,
  durationMs: number
): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  try {
    after(async () => {
      try {
        const key = keyFor(operation);
        const tx = redis.multi();
        tx.lpush(key, String(Math.round(durationMs * 10) / 10));
        tx.ltrim(key, 0, CAPACITY - 1);
        tx.incr(`${key}:total`);
        tx.expire(key, RETENTION_SECONDS);
        tx.expire(`${key}:total`, RETENTION_SECONDS);
        await tx.exec();
      } catch {
        /* Telemetry must never affect the user request. */
      }
    });
  } catch {
    /* Called outside a request lifecycle in tests or background work. */
  }
}

export async function getThreadReferenceMetricsSnapshot() {
  return Promise.all(
    operations.map(async (operation) => {
      const key = keyFor(operation);
      const [values, total] = await Promise.all([
        redis.lrange<string[]>(key, 0, CAPACITY - 1),
        redis.get<number>(`${key}:total`),
      ]);
      const samples = (values ?? [])
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const percentile = (p: number) =>
        samples.length ? samples[Math.ceil(samples.length * p) - 1]! : null;
      return {
        operation,
        total: typeof total === "number" ? total : Number(total ?? 0),
        samples: samples.length,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
      };
    })
  );
}
