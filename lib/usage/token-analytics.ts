import { SURFACE_LABELS, type UsageSurface } from "./surfaces";

export type TokenBucket = {
  day: string;
  surface: string;
  model: string;
  operation: string;
  input: number;
  cached: number;
  uncached: number;
  unknown: number;
  output: number;
  calls: number;
};
export type TokenTotals = Pick<
  TokenBucket,
  "input" | "cached" | "uncached" | "unknown" | "output" | "calls"
>;
export type TokenAnalytics = { start: string; end: string; rows: TokenBucket[] };
export const surfaceLabel = (surface: string) =>
  SURFACE_LABELS[surface as UsageSurface] ?? "Unclassified";
export function tokenTotals(rows: TokenTotals[]): TokenTotals {
  return rows.reduce(
    (sum, row) => ({
      input: sum.input + row.input,
      cached: sum.cached + row.cached,
      uncached: sum.uncached + row.uncached,
      unknown: sum.unknown + row.unknown,
      output: sum.output + row.output,
      calls: sum.calls + row.calls,
    }),
    { input: 0, cached: 0, uncached: 0, unknown: 0, output: 0, calls: 0 }
  );
}
export function cacheRate(row: TokenTotals): number | null {
  const known = row.cached + row.uncached;

  return known > 0 ? row.cached / known : null;
}
export function groupTokens(
  rows: TokenBucket[],
  dimension: "surface" | "model" | "day" | "operation"
) {
  const groups = new Map<string, TokenTotals>();

  for (const row of rows) {
    groups.set(row[dimension], tokenTotals([groups.get(row[dimension]) ?? tokenTotals([]), row]));
  }

  return Array.from(groups, ([key, totals]) => ({ key, ...totals }));
}
