"use client";

import type { UsageDailyBucket } from "@/lib/usage/aggregate";

import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import { formatTokenCount, formatUsd } from "@/lib/usage/format";
import { UsageSectionHeader } from "./usage-section-header";
import { usageSectionCaption } from "./usage-typography";

type UsageChartProps = {
  daily: UsageDailyBucket[];
  className?: string;
};

const CHART_HEIGHT = 120;
const CHART_PAD_X = 4;
const CHART_PAD_Y = 8;

export function UsageChart({ daily, className }: UsageChartProps) {
  const gradientId = useId();

  const { points, areaPath, maxTokens, hasData } = useMemo(() => {
    const max = Math.max(...daily.map((d) => d.totalTokens), 1);
    const width = 100;
    const innerW = width - CHART_PAD_X * 2;
    const innerH = CHART_HEIGHT - CHART_PAD_Y * 2;
    const step = daily.length > 1 ? innerW / (daily.length - 1) : 0;

    const coords = daily.map((bucket, index) => {
      const x = CHART_PAD_X + index * step;
      const y = CHART_PAD_Y + innerH - (bucket.totalTokens / max) * innerH;

      return { x, y, bucket };
    });

    const baseline = CHART_HEIGHT - CHART_PAD_Y;
    const area =
      coords.length > 0
        ? `M ${coords[0].x} ${baseline} ` +
          coords.map((c) => `L ${c.x} ${c.y}`).join(" ") +
          ` L ${coords[coords.length - 1].x} ${baseline} Z`
        : "";

    return {
      points: coords,
      areaPath: area,
      maxTokens: max,
      hasData: daily.some((d) => d.totalTokens > 0),
    };
  }, [daily]);

  const firstLabel = daily[0]?.date.slice(5) ?? "";
  const lastLabel = daily[daily.length - 1]?.date.slice(5) ?? "";

  return (
    <div className={cn("space-y-2", className)}>
      <UsageSectionHeader
        aside={
          !hasData ? (
            <p className={usageSectionCaption}>No usage in this range yet</p>
          ) : undefined
        }
        caption={`Peak day · ${formatTokenCount(maxTokens)} tokens`}
        title="Tokens over time"
      />

      <div
        className={cn(
          "relative rounded-xl border border-border/50 bg-muted/15 p-2",
          "[--usage-chart-line:var(--lumen-oklch)]",
          "[--usage-chart-fill-0:color-mix(in_oklch,var(--lumen-oklch)_32%,transparent)]",
          "[--usage-chart-fill-1:color-mix(in_oklch,var(--lumen-oklch)_6%,transparent)]",
          "dark:[--usage-chart-line:var(--lumen-rim-oklch)]",
          "dark:[--usage-chart-fill-0:color-mix(in_oklch,var(--lumen-rim-oklch)_35%,transparent)]",
          "dark:[--usage-chart-fill-1:color-mix(in_oklch,var(--lumen-rim-oklch)_2%,transparent)]"
        )}
      >
        <svg
          aria-hidden
          className="h-[120px] w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${CHART_HEIGHT}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--usage-chart-fill-0)" />
              <stop offset="100%" stopColor="var(--usage-chart-fill-1)" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              stroke="hsl(var(--border) / 0.35)"
              strokeDasharray="2 3"
              x1={CHART_PAD_X}
              x2={100 - CHART_PAD_X}
              y1={CHART_PAD_Y + (CHART_HEIGHT - CHART_PAD_Y * 2) * (1 - ratio)}
              y2={CHART_PAD_Y + (CHART_HEIGHT - CHART_PAD_Y * 2) * (1 - ratio)}
            />
          ))}

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}

          {points.length > 1 ? (
            <polyline
              className="[stroke:var(--usage-chart-line)]"
              fill="none"
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        <div className="mt-1 flex justify-between px-1 text-[10px] tabular-nums text-muted-foreground/80">
          <span>{firstLabel}</span>
          <span>{lastLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function UsageCostChart({ daily, className }: UsageChartProps) {
  const maxCost = Math.max(...daily.map((d) => d.costUsd), 0.0001);

  return (
    <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(3px,1fr))] items-end gap-px h-8", className)}>
      {daily.map((bucket) => {
        const heightPct = Math.max(4, (bucket.costUsd / maxCost) * 100);

        return (
          <div
            key={bucket.date}
            className="group relative min-w-0 flex-1"
            title={`${bucket.date}: ${formatUsd(bucket.costUsd)}`}
          >
            <div
              className="mx-auto w-full max-w-[6px] rounded-sm bg-lumen/70 transition-opacity group-hover:opacity-100 opacity-80"
              style={{ height: `${heightPct}%`, minHeight: bucket.costUsd > 0 ? 4 : 1 }}
            />
          </div>
        );
      })}
    </div>
  );
}
