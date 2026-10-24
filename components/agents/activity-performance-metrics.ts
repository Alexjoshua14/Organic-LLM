export type TimingSummary = { mean: number; p95: number; count: number };

/** Fixed target cadence, not observed RAF spacing; overload remains visible above 100%. */
export function processingBudgetPercent(workMs: number, targetFps: number): number {
  if (!Number.isFinite(workMs) || workMs < 0 || !Number.isFinite(targetFps) || targetFps <= 0) {
    throw new Error("Invalid frame budget");
  }

  return (workMs / (1000 / targetFps)) * 100;
}

/** Nearest-rank p95 over actual samples; absent samples remain unknown, never invented zeros. */
export function summarizeTimings(values: number[]): TimingSummary | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);

  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    count: values.length,
  };
}
