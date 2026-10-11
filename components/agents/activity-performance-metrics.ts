export type TimingSummary = { mean: number; p95: number; count: number };

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
