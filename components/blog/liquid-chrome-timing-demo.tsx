"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BlogFigure } from "./blog-figure";

import { ADAPTIVE_CHROME_TIMING as T } from "@/components/background/adaptive-chrome-timing";
import { Input } from "@/components/third-party/ui/input";
import { cn } from "@/lib/utils";

type Phase = "rest" | "dimmed" | "to65";

const DIMMED_OPACITY = 1 - T.dimIntensity;

/** What the readout calls each phase. */
const PHASE_LABEL: Record<Phase, string> = {
  rest: "At rest",
  dimmed: "Dimmed",
  to65: "Brightening",
};

const TRANSITION_MS: Record<Phase, number> = {
  dimmed: T.dimMs,
  to65: T.to65Ms,
  rest: T.to100Ms,
};

const TARGET_OPACITY: Record<Phase, number> = {
  dimmed: DIMMED_OPACITY,
  to65: T.brightenTo,
  rest: 1,
};

/** The three legs of a full cycle, widths proportional to their duration. */
const LEGS = [
  { label: "Dim", ms: T.dimMs, from: "100%", to: `${Math.round(DIMMED_OPACITY * 100)}%` },
  {
    label: "Back to 65%",
    ms: T.to65Ms,
    from: `${Math.round(DIMMED_OPACITY * 100)}%`,
    to: `${Math.round(T.brightenTo * 100)}%`,
  },
  {
    label: "The long exhale",
    ms: T.to100Ms,
    from: `${Math.round(T.brightenTo * 100)}%`,
    to: "100%",
  },
] as const;

const TOTAL_MS = LEGS.reduce((sum, leg) => sum + leg.ms, 0);

/**
 * A live model of the background's dim and two-phase brighten, driven by the same timing the real
 * component reads (adaptive-chrome-timing.ts). The "background" is a plain gradient so the page
 * never runs a second WebGL canvas; what you are meant to feel is the timing, not the shader.
 */
export function LiquidChromeTimingDemo() {
  const [phase, setPhase] = useState<Phase>("rest");
  const [pct, setPct] = useState(100);
  const stageRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);

  const clearSettle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  };

  const dim = useCallback(() => {
    clearSettle();
    setPhase("dimmed");
  }, []);

  const release = useCallback(() => {
    if (hoverRef.current || focusRef.current) return;
    clearSettle();
    setPhase("to65");
    settleTimer.current = setTimeout(() => setPhase("rest"), T.to65Ms);
  }, []);

  // Read the real, interpolated opacity while a transition runs, then stop.
  useEffect(() => {
    const el = stageRef.current;

    if (!el) return;

    const end = performance.now() + TRANSITION_MS[phase] + 120;
    const tick = () => {
      setPct(Math.round(Number.parseFloat(getComputedStyle(el).opacity) * 100));
      if (performance.now() < end) raf.current = requestAnimationFrame(tick);
      else setPct(Math.round(TARGET_OPACITY[phase] * 100));
    };

    raf.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  useEffect(() => clearSettle, []);

  return (
    <BlogFigure caption="A model of the real timing. The gradient stands in for the shader.">
      <div className="space-y-stack-lg rounded-xl border border-border bg-secondary/40 p-inset-xl">
        <div className="relative overflow-hidden rounded-lg border border-border/60">
          <div
            ref={stageRef}
            aria-hidden
            className="absolute inset-0 bg-linear-to-br from-lumen/50 via-accent/30 to-background motion-reduce:transition-none!"
            style={{
              opacity: TARGET_OPACITY[phase],
              transition: `opacity ${TRANSITION_MS[phase]}ms ${T.ease}`,
            }}
          />
          <div className="relative flex min-h-48 items-center justify-center p-inset-xl">
            <div
              className="w-full max-w-sm rounded-xl border border-border bg-background/70 p-inset-lg backdrop-blur-md"
              onPointerEnter={() => {
                hoverRef.current = true;
                dim();
              }}
              onPointerLeave={() => {
                hoverRef.current = false;
                release();
              }}
            >
              <label
                className="mb-stack-sm block text-xs text-muted-foreground"
                htmlFor="chrome-demo"
              >
                Hover here, or click into the field
              </label>
              <Input
                id="chrome-demo"
                placeholder="Type something…"
                onBlur={() => {
                  focusRef.current = false;
                  release();
                }}
                onFocus={() => {
                  focusRef.current = true;
                  dim();
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-inline-lg">
          <p aria-live="polite" className="text-sm text-foreground">
            {PHASE_LABEL[phase]}
          </p>
          <p className="font-mono text-sm tabular-nums text-muted-foreground">background {pct}%</p>
        </div>

        <div>
          <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-border/60">
            {LEGS.map((leg, i) => (
              <div
                key={leg.label}
                className={cn("h-full border-r border-background last:border-r-0")}
                style={{
                  width: `${(leg.ms / TOTAL_MS) * 100}%`,
                  background: `rgb(var(--lumen-deep) / ${0.35 + i * 0.3})`,
                }}
              />
            ))}
          </div>
          <ul className="mt-stack-md grid list-none grid-cols-3 gap-inline-sm p-0 text-xs text-muted-foreground">
            {LEGS.map((leg) => (
              <li key={leg.label}>
                <span className="block font-medium text-foreground/90">{leg.label}</span>
                <span className="tabular-nums">
                  {leg.from} to {leg.to}, {(leg.ms / 1000).toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BlogFigure>
  );
}
