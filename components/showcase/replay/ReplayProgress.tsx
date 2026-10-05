"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type ReplayBar = {
  durationMs: number;
  /** Chapter boundaries as 0–1 fractions of the whole replay, excluding the start. */
  marks: readonly number[];
};

type ReplayProgressProps = {
  progress: number;
  playing: boolean;
  bar?: ReplayBar;
  className?: string;
};

/** Resync the animation when React's clock and the animation drift further apart than this. */
const DRIFT_TOLERANCE = 0.03;

/**
 * Progress fill that runs on the compositor: while playing, a single linear animation carries
 * it to the end, so it stays smooth when a heavy stage drops React frames. React's `progress`
 * only re-anchors it after a seek, restart, or stall. Without `bar` it follows `progress`.
 */
export function ReplayProgress({ progress, playing, bar, className }: ReplayProgressProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const anchorRef = useRef({ from: 0, at: 0 });
  const clamped = Math.min(1, Math.max(0, progress));
  const durationMs = bar?.durationMs ?? 0;

  useEffect(() => {
    const fill = fillRef.current;

    if (!fill || typeof fill.animate !== "function") return;

    if (!playing || durationMs <= 0 || clamped >= 1) {
      animationRef.current?.cancel();
      animationRef.current = null;

      return;
    }

    const { from, at } = anchorRef.current;
    const expected = from + (performance.now() - at) / durationMs;

    if (animationRef.current && Math.abs(expected - clamped) < DRIFT_TOLERANCE) return;

    animationRef.current?.cancel();
    anchorRef.current = { from: clamped, at: performance.now() };
    animationRef.current = fill.animate(
      [{ transform: `scaleX(${clamped})` }, { transform: "scaleX(1)" }],
      { duration: (1 - clamped) * durationMs, easing: "linear", fill: "forwards" }
    );
  }, [clamped, durationMs, playing]);

  useEffect(
    () => () => {
      animationRef.current?.cancel();
    },
    []
  );

  return (
    <div
      aria-hidden
      className={cn("relative h-1.5 overflow-hidden rounded-full bg-muted/40", className)}
    >
      <div
        ref={fillRef}
        className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-amber-400/80 to-sky-400/70"
        style={{ transform: `scaleX(${clamped})` }}
      />
      {bar?.marks.map((mark) => (
        <span
          key={mark}
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background/90"
          style={{ left: `${mark * 100}%` }}
        />
      ))}
    </div>
  );
}

/** Live status shown beside the controls so a running demo never looks idle. */
export function ReplayStatus({
  playing,
  progress,
  durationMs,
  reduceMotion,
  chapterIndex,
  chapterCount,
}: {
  playing: boolean;
  progress: number;
  durationMs?: number;
  reduceMotion: boolean;
  chapterIndex: number;
  chapterCount: number;
}) {
  if (reduceMotion) {
    return (
      <span className="text-[11px] tabular-nums text-muted-foreground">
        Chapter {chapterIndex + 1} of {chapterCount}
      </span>
    );
  }

  const finished = !playing && progress >= 0.999;
  const label = playing ? "Playing" : finished ? "Finished" : "Paused";
  const elapsed = durationMs ? formatClock(progress * durationMs) : null;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          playing ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-muted-foreground/40"
        )}
      />
      {label}
      {elapsed && durationMs ? (
        <span aria-hidden className="text-muted-foreground/70">
          {elapsed} / {formatClock(durationMs)}
        </span>
      ) : null}
    </span>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
