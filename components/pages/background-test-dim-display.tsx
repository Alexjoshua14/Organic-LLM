"use client";

import { useEffect, useState, useRef } from "react";

const EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const TRANSITION_MS = 2500;
const REST_DELAY_MS = 2400;

type Phase = "resting" | "dimmed" | "returning";

interface DimLevelDisplayProps {
  dimmed: boolean;
  /** ms before background returns to rest (for "returning" label). */
  restDelayMs?: number;
  /** ms for opacity transition (for bar animation sync). */
  transitionMs?: number;
}

/**
 * Realtime display of AdaptiveLiquidChrome dim state: vertical bar (volume-style)
 * and label. Bar animation matches the background’s transition timing.
 */
export function DimLevelDisplay({
  dimmed,
  restDelayMs = REST_DELAY_MS,
  transitionMs = TRANSITION_MS,
}: DimLevelDisplayProps) {
  const [phase, setPhase] = useState<Phase>(dimmed ? "dimmed" : "resting");
  const [displayLevel, setDisplayLevel] = useState(dimmed ? 1 : 0);
  const returnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const animStartRef = useRef<number>(0);
  const animFromRef = useRef(0);
  const animToRef = useRef(0);

  // Phase label: show "Returning" during rest delay
  useEffect(() => {
    if (dimmed) {
      if (returnTimeoutRef.current) {
        clearTimeout(returnTimeoutRef.current);
        returnTimeoutRef.current = null;
      }
      setPhase("dimmed");

      return;
    }
    setPhase("returning");
    returnTimeoutRef.current = setTimeout(() => {
      setPhase("resting");
      returnTimeoutRef.current = null;
    }, restDelayMs);

    return () => {
      if (returnTimeoutRef.current) clearTimeout(returnTimeoutRef.current);
    };
  }, [dimmed, restDelayMs]);

  // Animate displayLevel: 0→1 when dimmed, 1→0 after restDelay when not dimmed
  useEffect(() => {
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

    if (dimmed) {
      animStartRef.current = performance.now();
      animFromRef.current = displayLevel;
      animToRef.current = 1;
      const tick = (now: number) => {
        const elapsed = now - animStartRef.current;
        const p = Math.min(elapsed / transitionMs, 1);
        const eased = animFromRef.current + (animToRef.current - animFromRef.current) * ease(p);

        setDisplayLevel(eased);
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    // Not dimmed: wait restDelay then animate 1 → 0
    const t = setTimeout(() => {
      animStartRef.current = performance.now();
      animFromRef.current = 1;
      animToRef.current = 0;
      const tick = (now: number) => {
        const elapsed = now - animStartRef.current;
        const p = Math.min(elapsed / transitionMs, 1);
        const eased = animFromRef.current + (animToRef.current - animFromRef.current) * ease(p);

        setDisplayLevel(eased);
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    }, restDelayMs);

    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dimmed]);

  const barTransition = dimmed
    ? `height ${transitionMs}ms ${EASING}`
    : `height ${transitionMs}ms ${EASING} ${restDelayMs}ms`;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between w-full gap-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Dim level
        </span>
        <span className="text-xs tabular-nums text-foreground">
          {Math.round(displayLevel * 100)}%
        </span>
      </div>
      {/* Vertical bar (volume-style) */}
      <div className="flex items-end gap-2">
        <div
          aria-hidden
          className="w-3 h-24 rounded-full bg-muted overflow-hidden flex flex-col justify-end"
        >
          <div
            className="w-full bg-primary/80 rounded-full"
            style={{
              height: dimmed ? "100%" : "0%",
              transition: barTransition,
            }}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground capitalize">
        {phase === "returning" ? `Returning in ${(restDelayMs / 1000).toFixed(1)}s` : phase}
      </span>
    </div>
  );
}
