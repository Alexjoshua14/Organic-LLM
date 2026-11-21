import type { MeasureDomain } from "@/lib/schemas/gen-ui";

export type Domain = MeasureDomain;

export const toPct = (v: number, d: Domain) =>
  Math.min(100, Math.max(0, ((v - d.min) / (d.max - d.min)) * 100));

export const makeTicks = (d: Domain, n = 5) =>
  Array.from({ length: n }, (_, i) => d.min + ((d.max - d.min) * i) / (n - 1));
