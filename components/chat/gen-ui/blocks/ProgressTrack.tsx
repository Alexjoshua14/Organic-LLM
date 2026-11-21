"use client";

import type { ProgressTrackBlock } from "@/lib/schemas/gen-ui";

import { useReducedMotion } from "framer-motion";

import {
  PROGRESS_TRACK_FILL_EASE,
  PROGRESS_TRACK_FILL_MS,
} from "../progress-track/progress-track-timing";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type ProgressTrackProps = {
  block: ProgressTrackBlock;
  partial?: boolean;
};

export function ProgressTrack({ block }: ProgressTrackProps) {
  const reduceMotion = useReducedMotion();
  const pct = Math.min(100, Math.max(0, (block.current / block.total) * 100));
  const unit = block.unit;

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

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{
            width: `${pct}%`,
            transition: reduceMotion
              ? undefined
              : `width ${PROGRESS_TRACK_FILL_MS}ms ${PROGRESS_TRACK_FILL_EASE}`,
          }}
        />
        {block.milestones.map((m) => {
          const left = Math.min(100, Math.max(0, (m.value / block.total) * 100));

          return (
            <span
              key={`${m.label}:${m.value}`}
              title={`${m.label} (${m.value}${unit})`}
              aria-label={`${m.label} at ${m.value}${unit}`}
              className="absolute top-0 bottom-0 w-px bg-foreground/80"
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
