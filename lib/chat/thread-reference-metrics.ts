const OPERATIONS = [
  "resolve",
  "cache-hit",
  "cache-miss",
  "clipboard-read",
  "clipboard-copy",
] as const;
export type ThreadReferenceOperation = (typeof OPERATIONS)[number];
const CAPACITY = 512;

/** Fixed-memory, O(1) process-local collector retained for deterministic tests. */
export function createThreadReferenceMetrics() {
  const rings = Object.fromEntries(
    OPERATIONS.map((operation) => [operation, { values: new Float64Array(CAPACITY), count: 0 }])
  ) as Record<ThreadReferenceOperation, { values: Float64Array; count: number }>;
  return {
    record(operation: ThreadReferenceOperation, durationMs: number) {
      if (!Number.isFinite(durationMs) || durationMs < 0) return;
      const ring = rings[operation];
      ring.values[ring.count % CAPACITY] = durationMs;
      ring.count += 1;
    },
    snapshot() {
      return OPERATIONS.map((operation) => {
        const ring = rings[operation];
        const samples = Array.from(ring.values.slice(0, Math.min(ring.count, CAPACITY))).sort(
          (a, b) => a - b
        );
        const percentile = (p: number) =>
          samples.length ? samples[Math.ceil(samples.length * p) - 1]! : null;
        return {
          operation,
          total: ring.count,
          samples: samples.length,
          p50: percentile(0.5),
          p95: percentile(0.95),
          p99: percentile(0.99),
        };
      });
    },
  };
}
