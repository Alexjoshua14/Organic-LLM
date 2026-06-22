"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const TO65_MS = 1200;
const TO100_MS = 2800;

type Phase = "rest" | "dimmed" | "to65" | "returning";

type DimStatePanelProps = {
  dimmed: boolean;
  className?: string;
};

const PHASE_COPY: Record<Phase, { label: string; detail: string }> = {
  rest: { label: "At rest", detail: "Chrome at full brightness — awaiting interaction." },
  dimmed: { label: "Dimmed", detail: "Hover or focus is inside a trigger zone." },
  to65: { label: "Brightening · phase 1", detail: "Quick return to ~65% opacity." },
  returning: { label: "Brightening · phase 2", detail: "Slow exhale back to full brightness." },
};

/**
 * Live readout of AdaptiveLiquidChrome brightness phases, synced to the component’s timing.
 */
export function DimStatePanel({ dimmed, className }: DimStatePanelProps) {
  const [phase, setPhase] = useState<Phase>(dimmed ? "dimmed" : "rest");
  const [level, setLevel] = useState(dimmed ? 0.55 : 1);
  const levelRef = useRef(level);
  const rafRef = useRef<number | null>(null);

  levelRef.current = level;

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const DIMMED_LEVEL = 0.55;

    const animate = (from: number, to: number, durationMs: number, onDone?: () => void) => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / durationMs, 1);
        const next = from + (to - from) * easeOut(p);
        levelRef.current = next;
        setLevel(next);
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onDone?.();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (dimmed) {
      setPhase("dimmed");
      animate(levelRef.current, DIMMED_LEVEL, 700);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    setPhase("to65");
    animate(levelRef.current, 0.65, TO65_MS, () => {
      setPhase("returning");
      animate(0.65, 1, TO100_MS, () => setPhase("rest"));
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dimmed]);

  const { label, detail } = PHASE_COPY[phase];
  const ringOpacity = Math.max(0.2, Math.min(1, level));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-md",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/15 blur-2xl transition-opacity duration-700"
        style={{ opacity: 1 - level }}
      />

      <div className="relative flex items-start gap-5">
        <div className="relative flex size-20 shrink-0 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border-2 border-primary/25 transition-all duration-700"
            style={{
              opacity: ringOpacity,
              transform: `scale(${0.85 + level * 0.15})`,
              transitionTimingFunction: EASING,
            }}
          />
          <div
            className="size-14 rounded-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent transition-opacity duration-700"
            style={{ opacity: ringOpacity }}
          />
          <span className="relative text-lg font-medium tabular-nums text-foreground">
            {Math.round(level * 100)}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Live brightness
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                phase === "dimmed"
                  ? "bg-primary/15 text-primary"
                  : phase === "rest"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
              )}
            >
              {label}
            </span>
          </div>
          <p className="text-sm leading-snug text-foreground/90">{detail}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
              style={{ width: `${level * 100}%`, transitionTimingFunction: EASING }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
