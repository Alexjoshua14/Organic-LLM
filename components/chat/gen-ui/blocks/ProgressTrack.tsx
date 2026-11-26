"use client";

import type { CSSProperties } from "react";
import type { ProgressTrackBlock } from "@/lib/schemas/gen-ui";

import { useReducedMotion } from "framer-motion";

import {
  PROGRESS_TRACK_FILL_EASE,
  PROGRESS_TRACK_FILL_MS,
} from "../progress-track/progress-track-timing";

import { CompositionStroke } from "@/components/design-system/composition-bar";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type ProgressTrackProps = {
  block: ProgressTrackBlock;
  partial?: boolean;
  /** Compact visual summary: big value, slim track with milestone ticks, next-milestone chip. */
  condensed?: boolean;
};

function percentOf(value: number, total: number) {
  return Math.min(100, Math.max(0, (value / total) * 100));
}

/** Same rail as measure bars: stroke height, not clipped, so the fill's glow can show. */
const TRACK = "relative h-1 w-full rounded-full bg-muted/40";
/** Milestones stand proud of the stroke so they read on a 4px line. */
const TICK = "absolute -inset-y-1 -translate-x-1/2 rounded-full";

/** The filled share, drawn with the app's one bar stroke (context usage's glow material). */
function ProgressFill({ style }: { style: CSSProperties }) {
  return (
    <div className="absolute inset-y-0 left-0" style={style}>
      <CompositionStroke className="w-full" color="var(--color-accent)" />
    </div>
  );
}

export function ProgressTrack({ block, condensed = false }: ProgressTrackProps) {
  const reduceMotion = useReducedMotion();
  const pct = percentOf(block.current, block.total);
  const unit = block.unit;
  const fillStyle = {
    width: `${pct}%`,
    transition: reduceMotion
      ? undefined
      : `width ${PROGRESS_TRACK_FILL_MS}ms ${PROGRESS_TRACK_FILL_EASE}`,
  };

  if (condensed) {
    const next = [...block.milestones]
      .filter((m) => m.value > block.current)
      .sort((a, b) => a.value - b.value)[0];
    const reached = block.milestones.filter((m) => m.value <= block.current).length;
    // A percent track already says its share; "/ 100%" and a "100%" chip would only repeat it.
    const isPercent = unit.trim() === "%" && block.total === 100;
    const done = block.current >= block.total;

    return (
      <section className="w-full space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
        <div className="flex items-baseline justify-between gap-inline-sm">
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{block.title}</h3>
          <p className="shrink-0 font-mono text-sm tabular-nums text-foreground">
            {block.current}
            {unit}
            {isPercent ? null : (
              <span className="text-xs text-muted-foreground">
                {" "}
                / {block.total}
                {unit}
              </span>
            )}
          </p>
        </div>

        <div
          role="progressbar"
          aria-label={block.title}
          aria-valuemin={0}
          aria-valuemax={block.total}
          aria-valuenow={block.current}
          aria-valuetext={`${block.current}${unit} of ${block.total}${unit}`}
          className={TRACK}
        >
          <ProgressFill style={fillStyle} />
          {block.milestones.map((m) => {
            const isNext = m === next;

            return (
              <span
                key={`${m.label}:${m.value}`}
                aria-hidden
                title={`${m.label} (${m.value}${unit})`}
                className={cn(TICK, isNext ? "w-0.5 bg-accent-warm" : "w-px bg-foreground/50")}
                style={{ left: `${percentOf(m.value, block.total)}%` }}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-inline-xs text-2xs">
          {done ? (
            <span className="rounded-full bg-accent/15 px-inset-sm py-0.5 text-foreground">
              Complete
            </span>
          ) : isPercent ? null : (
            <span className="rounded-full bg-accent/15 px-inset-sm py-0.5 font-mono tabular-nums text-foreground">
              {Math.round(pct)}%
            </span>
          )}
          {block.milestones.length > 0 && !done ? (
            <span
              className="rounded-full bg-muted/60 px-inset-sm py-0.5 tabular-nums text-muted-foreground"
              aria-label={`${reached} of ${block.milestones.length} milestones reached`}
            >
              {reached}/{block.milestones.length} milestones
            </span>
          ) : null}
          {next ? (
            <span className="inline-flex min-w-0 items-center gap-inline-xs rounded-full bg-accent-warm/15 px-inset-sm py-0.5 text-foreground">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-warm" />
              <span className="truncate">
                Next · {next.label} · {next.value}
                {unit}
              </span>
            </span>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <div className="flex items-baseline justify-between gap-inline-md">
        <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {block.current}
          {unit} / {block.total}
          {unit}
        </span>
      </div>

      <div className={TRACK}>
        <ProgressFill style={fillStyle} />
        {block.milestones.map((m) => {
          const left = percentOf(m.value, block.total);

          return (
            <span
              key={`${m.label}:${m.value}`}
              title={`${m.label} (${m.value}${unit})`}
              aria-label={`${m.label} at ${m.value}${unit}`}
              className={cn(TICK, "w-px bg-foreground/50")}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>

      {block.milestones.length > 0 ? (
        <ul className="flex flex-wrap gap-x-inline-md gap-y-stack-xs text-xs text-muted-foreground">
          {block.milestones.map((m) => (
            <li key={`${m.label}:${m.value}`} className="font-mono tabular-nums">
              {m.label} · {m.value}
              {unit}
            </li>
          ))}
        </ul>
      ) : null}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
