import type { MeasureDomain, MeasureRow } from "@/lib/schemas/gen-ui";

export type Domain = MeasureDomain;

export const toPct = (v: number, d: Domain) =>
  Math.min(100, Math.max(0, ((v - d.min) / (d.max - d.min)) * 100));

export const makeTicks = (d: Domain, n = 5) =>
  Array.from({ length: n }, (_, i) => d.min + ((d.max - d.min) * i) / (n - 1));

/** Point used by column / line / pie charts when a row may only have a range. */
export function measureRowPoint(row: MeasureRow): number {
  if (row.value !== undefined) return row.value;
  const [lo, hi] = row.range!;

  return (lo + hi) / 2;
}
