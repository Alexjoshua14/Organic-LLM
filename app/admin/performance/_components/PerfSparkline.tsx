import type { PerfDailyRow } from "@/lib/perf/summary-core";

const W = 120;
const H = 28;
const PAD = 3;

/**
 * Daily p95 for one journey: a single thin line, so no legend is needed (the row names it).
 * The last value is labelled directly; the table beside it is the accessible data view.
 */
export function PerfSparkline({ points, label }: { points: PerfDailyRow[]; label: string }) {
  if (points.length < 2) {
    return <span className="text-2xs text-muted-foreground">Needs 2+ days</span>;
  }

  const max = Math.max(...points.map((p) => p.p95), 1);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.p95).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <span className="inline-flex items-center gap-2">
      <svg
        aria-label={`${label}: daily p95, latest ${Math.round(last.p95)} milliseconds`}
        className="text-foreground/70"
        height={H}
        role="img"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
      >
        <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} />
        <circle cx={x(points.length - 1)} cy={y(last.p95)} fill="currentColor" r={3} />
      </svg>
      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(last.p95)} ms</span>
    </span>
  );
}
