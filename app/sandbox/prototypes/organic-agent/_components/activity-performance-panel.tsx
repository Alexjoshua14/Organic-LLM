"use client";

import type { RefObject } from "react";
import type { TimingSummary } from "@/components/agents/activity-performance-metrics";
import type { DotPhysicsScheduler } from "@/components/agents/dot-physics-scheduler";

import { useEffect, useState } from "react";

import {
  processingBudgetPercent,
  summarizeTimings,
} from "@/components/agents/activity-performance-metrics";
import { dotPhysicsScheduler } from "@/components/agents/dot-physics-scheduler";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const SAMPLE_MS = 500;
const HISTORY_POINTS = 40;
const TARGET_FRAME_RATES = [30, 60, 90, 120];

export type PerformanceVariant = { id: string; label: string };
type VariantReading = { renderer: string; timings: TimingSummary | null };
type Reading = {
  fps: number | null;
  frames: TimingSummary | null;
  updates: TimingSummary | null;
  variants: Record<string, VariantReading>;
  longTasks: number | null;
  longTaskMs: number;
  fpsHistory: number[];
  frameHistory: number[];
  updateHistory: number[];
};
const EMPTY: Reading = {
  fps: null,
  frames: null,
  updates: null,
  variants: {},
  longTasks: null,
  longTaskMs: 0,
  fpsHistory: [],
  frameHistory: [],
  updateHistory: [],
};
const formatMs = (value: number) => value.toFixed(3);

function HistoryGraph({
  values,
  reference,
  label,
}: {
  values: number[];
  reference: number;
  label: string;
}) {
  const max = Math.max(reference * 1.25, ...values, 0.001);
  const y = (value: number) => 48 - (value / max) * 44;
  const points = values
    .map((value, index) => `${(index / (HISTORY_POINTS - 1)) * 240},${y(value)}`)
    .join(" ");

  return (
    <svg
      aria-label={label}
      className="mt-1.5 h-7 w-full overflow-visible text-accent sm:h-8"
      role="img"
      viewBox="0 0 240 52"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        x2="240"
        y1={y(reference)}
        y2={y(reference)}
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
      />
      {values.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/** Bench-only instrumentation; frame cadence is page-wide, JS updates are grouped per preview. */
export function ActivityPerformancePanel({
  previewRef,
  variants,
  scheduler = dotPhysicsScheduler,
}: {
  previewRef: RefObject<HTMLElement | null>;
  variants: PerformanceVariant[];
  /** Actual sample transport stays injectable for DOM delivery tests. */
  scheduler?: DotPhysicsScheduler;
}) {
  const [reading, setReading] = useState<Reading>(EMPTY);
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const [targetFps, setTargetFps] = useState(60);
  const frameBudgetMs = 1000 / targetFps;
  const budgetUsed = reading.updates
    ? processingBudgetPercent(reading.updates.p95, targetFps)
    : null;

  useEffect(() => {
    if (paused || typeof window.requestAnimationFrame !== "function") return;
    let raf: number | null = null;
    let lastFrame: number | null = null;
    let windowStart = performance.now();
    let frames: number[] = [];
    let updates: number[] = [];
    let groups = new Map<string, number[]>();
    let longTasks: number | null = null;
    let longTaskMs = 0;
    let observer: PerformanceObserver | null = null;
    const removeMetrics = scheduler.subscribeMetrics((sample) => {
      updates.push(sample.updateMs);
      sample.groups.forEach((group) => {
        const values = groups.get(group.id) ?? [];

        values.push(group.updateMs);
        groups.set(group.id, values);
      });
    });

    try {
      if (
        typeof PerformanceObserver !== "undefined" &&
        PerformanceObserver.supportedEntryTypes.includes("longtask")
      ) {
        longTasks = 0;
        observer = new PerformanceObserver((list) => {
          if (document.hidden) return;
          for (const entry of list.getEntries()) {
            longTasks!++;
            longTaskMs += entry.duration;
          }
        });
        observer.observe({ type: "longtask" });
      }
    } catch {
      observer?.disconnect();
      longTasks = null;
    }

    const tick = (time: number) => {
      if (lastFrame !== null && time > lastFrame) frames.push(time - lastFrame);
      lastFrame = time;
      if (time - windowStart >= SAMPLE_MS) {
        const frameSummary = summarizeTimings(frames);
        const updateSummary = summarizeTimings(updates);
        const fps = frameSummary ? 1000 / frameSummary.mean : null;
        const variantReadings: Record<string, VariantReading> = {};

        for (const variant of variants) {
          const preview = previewRef.current?.querySelector(
            `[data-performance-preview="${variant.id}"]`
          );
          const renderer =
            preview?.querySelector("[data-dot-renderer]")?.getAttribute("data-dot-renderer") ??
            "unavailable";

          variantReadings[variant.id] = {
            renderer,
            timings: summarizeTimings(groups.get(variant.id) ?? []),
          };
        }
        setReading((previous) => ({
          fps,
          frames: frameSummary,
          updates: updateSummary,
          variants: variantReadings,
          longTasks,
          longTaskMs,
          fpsHistory:
            fps === null
              ? previous.fpsHistory
              : [...previous.fpsHistory, fps].slice(-HISTORY_POINTS),
          frameHistory:
            frameSummary === null
              ? previous.frameHistory
              : [...previous.frameHistory, frameSummary.p95].slice(-HISTORY_POINTS),
          updateHistory:
            updateSummary === null
              ? []
              : [...previous.updateHistory, updateSummary.p95].slice(-HISTORY_POINTS),
        }));
        frames = [];
        updates = [];
        groups = new Map();
        windowStart = time;
      }
      raf = window.requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
      raf = null;
      lastFrame = null;
      frames = [];
      updates = [];
      groups.clear();
      windowStart = performance.now();
      if (!document.hidden) raf = window.requestAnimationFrame(tick);
    };

    document.addEventListener("visibilitychange", visibility);
    visibility();

    return () => {
      removeMetrics();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [paused, reset, previewRef, variants, scheduler]);

  const maxVariantMs = Math.max(
    0.001,
    ...Object.values(reading.variants).map((item) => item.timings?.p95 ?? 0)
  );

  return (
    <section
      aria-label="Live activity performance"
      className={cn(glass(), "mt-3 overflow-hidden rounded-xl px-3 py-2.5")}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <h2 className="text-xs font-medium text-foreground">
            Performance{" "}
            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
              {paused ? "Paused" : "Live · 0.5s / ≈20s history"}
            </span>
          </h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Page cadence and measured animation work on this device.
          </p>
        </div>
        <div className="flex gap-2 text-[11px] text-muted-foreground">
          <label className="flex items-center gap-1.5">
            Target
            <select
              aria-label="Target frame rate"
              className={cn(glass(), "min-h-8 rounded-md px-1.5 text-[11px] text-foreground")}
              value={targetFps}
              onChange={(event) => setTargetFps(Number(event.target.value))}
            >
              {TARGET_FRAME_RATES.map((fps) => (
                <option key={fps} value={fps}>
                  {fps}fps
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-8 px-1 hover:text-foreground"
            type="button"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            className="min-h-8 px-1 hover:text-foreground"
            type="button"
            onClick={() => {
              setReading(EMPTY);
              setReset((value) => value + 1);
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <div>
          <p className="min-h-7 text-[10px] text-muted-foreground sm:min-h-0">Frame rate</p>
          <p className="mt-0.5 text-base font-light tabular-nums text-foreground">
            {reading.fps === null ? "—" : reading.fps.toFixed(1)}{" "}
            <span className="text-[10px] text-muted-foreground">fps</span>
          </p>
          <HistoryGraph
            values={reading.fpsHistory}
            reference={targetFps}
            label={`Page frame-rate history; dashed line is the ${targetFps}fps target`}
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">{targetFps}fps guide</p>
        </div>
        <div>
          <p className="min-h-7 text-[10px] text-muted-foreground sm:min-h-0">
            Frame interval · p95
          </p>
          <p className="mt-0.5 text-base font-light tabular-nums text-foreground">
            {reading.frames ? reading.frames.p95.toFixed(3) : "—"}{" "}
            <span className="text-[10px] text-muted-foreground">ms</span>
          </p>
          <HistoryGraph
            values={reading.frameHistory}
            reference={frameBudgetMs}
            label={`Frame-interval p95 history; dashed line is the ${frameBudgetMs.toFixed(2)}ms target budget`}
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {frameBudgetMs.toFixed(2)}ms guide
          </p>
        </div>
        <div>
          <p className="min-h-7 text-[10px] text-muted-foreground sm:min-h-0">JS · p95</p>
          <p className="mt-0.5 text-base font-light tabular-nums text-foreground">
            {reading.updates ? reading.updates.p95.toFixed(3) : "—"}{" "}
            <span className="text-[10px] text-muted-foreground">ms</span>
          </p>
          <HistoryGraph
            values={reading.updateHistory}
            reference={4}
            label="Combined spring and DOM-write p95 history; dashed line is the 4ms mean-work guard"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">4ms mean guard</p>
        </div>
        <div>
          <p className="min-h-7 text-[10px] text-muted-foreground sm:min-h-0">JS budget used</p>
          <p
            className={cn(
              "mt-0.5 text-base font-light tabular-nums text-foreground",
              budgetUsed !== null && budgetUsed >= 100 && "text-amber-700 dark:text-amber-400"
            )}
          >
            {budgetUsed === null ? "—" : budgetUsed.toFixed(1)}
            <span className="text-[10px] text-muted-foreground">%</span>
          </p>
          <HistoryGraph
            values={reading.updateHistory.map((ms) => processingBudgetPercent(ms, targetFps))}
            reference={100}
            label={`Measured animation JS share of the ${targetFps}fps frame budget; dashed line is 100%`}
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {frameBudgetMs.toFixed(2)}ms/frame
          </p>
        </div>
      </div>
      <div className="mt-2.5 border-t border-border/40 pt-2">
        <table className="w-full table-fixed text-left text-[10px] tabular-nums sm:text-[11px]">
          <caption className="sr-only">
            Per-preview measured JavaScript and DOM-write cost per active frame
          </caption>
          <thead className="text-[10px] font-normal text-muted-foreground">
            <tr>
              <th className="w-[34%] pb-1.5 font-normal">Variant / renderer</th>
              <th className="w-[18%] pb-1.5 font-normal">Mean ms</th>
              <th className="w-[34%] pb-1.5 font-normal">p95 ms / relative</th>
              <th className="w-[14%] pb-1.5 text-right font-normal">Frames</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => {
              const item = reading.variants[variant.id];
              const stats = item?.timings;
              const native = item?.renderer === "v0";

              return (
                <tr key={variant.id}>
                  <th className="py-1 pr-2 font-normal">
                    <span className="text-foreground">{variant.label}</span>
                    <span className="block text-[10px] leading-tight text-muted-foreground sm:ml-1.5 sm:inline">
                      {item
                        ? native
                          ? "Original v0"
                          : item.renderer === "physics"
                            ? "Physics"
                            : "Unavailable"
                        : "Sampling…"}
                    </span>
                  </th>
                  <td className="py-1 pr-2 text-muted-foreground">
                    {stats ? formatMs(stats.mean) : "—"}
                  </td>
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">
                        {stats
                          ? formatMs(stats.p95)
                          : !item
                            ? "Sampling…"
                            : native
                              ? "Unmeasured"
                              : "No active updates"}
                      </span>
                      <span className="h-1 min-w-2 flex-1 overflow-hidden rounded-full bg-foreground/5">
                        {stats && (
                          <span
                            className="block h-full rounded-full bg-accent/65"
                            style={{ width: `${(stats.p95 / maxVariantMs) * 100}%` }}
                          />
                        )}
                      </span>
                    </div>
                    {native && stats && (
                      <span className="text-[10px] text-muted-foreground">
                        Glass transition only
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-right text-muted-foreground">{stats?.count ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>
          Frame p95: {reading.frames?.count ?? "—"} raw intervals ·{" "}
          {reading.frames
            ? `${((reading.frames.mean * reading.frames.count) / 1000).toFixed(3)}s observed`
            : "Sampling…"}
        </span>
        <span>
          {variants.length} previews · {variants.length * 18} dots
        </span>
        <span>
          Long tasks ≥50ms:{" "}
          {reading.longTasks === null
            ? "Unavailable in this browser"
            : `${reading.longTasks} · ${reading.longTaskMs.toFixed(0)}ms total`}
        </span>
        {scheduler.failure && (
          <span className="text-foreground">Physics fallback: {scheduler.failure}</span>
        )}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        p95 uses nearest rank over raw samples; lower timings are better. Frame intervals include
        display pacing and idle time. JS includes all active spring/DOM work and profiling overhead.
        Page FPS includes the bench and varies with display refresh rate. Native animation,
        per-variant rendered FPS, GPU blur/compositing and battery are unmeasured. Budget % = JS p95
        ÷ (1000/target fps); 18ms at 60fps is 108%. Compare matching sizes; browser profiling is
        needed to isolate rendering cost.
      </p>
    </section>
  );
}
