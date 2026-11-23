"use client";

import { useEffect, useRef, useState } from "react";

import { BlogFigure } from "./blog-figure";

import { ADAPTIVE_CHROME_TIMING as T } from "@/components/background/adaptive-chrome-timing";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
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
 * The real AdaptiveLiquidChrome, the one behind the app, mounted inside a box. Nothing is
 * modelled here: the component listens for hover and focus on any `data-dim-background` element
 * and does its own dim and two-phase brighten; this figure only supplies a trigger, mounts the
 * shader while it is on screen (so a long post never holds a second WebGL context for nothing),
 * and reads the opacity the component is actually showing for the readout.
 */
export function LiquidChromeTimingDemo() {
  const [phase, setPhase] = useState<Phase>("rest");
  const [pct, setPct] = useState(100);
  const [visible, setVisible] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = stageRef.current;

    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "120px",
    });

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (restTimer.current) clearTimeout(restTimer.current);
    },
    []
  );

  const handleDimChange = (dimmed: boolean) => {
    if (restTimer.current) clearTimeout(restTimer.current);
    restTimer.current = null;
    if (dimmed) {
      setPhase("dimmed");

      return;
    }
    setPhase("to65");
    restTimer.current = setTimeout(() => setPhase("rest"), T.to65Ms);
  };

  // Read the opacity the real component is showing while it moves; idle at rest costs nothing.
  useEffect(() => {
    const layer = stageRef.current?.firstElementChild;

    if (!(layer instanceof HTMLElement) || !visible) return;
    let raf = 0;
    const end = performance.now() + (phase === "dimmed" ? T.dimMs : T.to65Ms + T.to100Ms) + 200;
    const tick = () => {
      setPct(Math.round(Number.parseFloat(getComputedStyle(layer).opacity) * 100));
      if (performance.now() < end) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [phase, visible]);

  return (
    <BlogFigure caption="The real background component, running in a box. Hover or focus the field.">
      <div className="space-y-stack-lg rounded-xl border border-border bg-secondary/40 p-inset-xl">
        <div className="relative isolate overflow-hidden rounded-lg border border-border/60">
          <div ref={stageRef} aria-hidden className="absolute inset-0 -z-10">
            {visible ? (
              <AdaptiveLiquidChrome
                cover="parent"
                interactive={false}
                onDimChange={handleDimChange}
              />
            ) : null}
          </div>
          <div className="relative flex min-h-48 items-center justify-center p-inset-xl">
            <div
              className="w-full max-w-sm rounded-xl border border-border bg-background/70 p-inset-lg backdrop-blur-md"
              data-dim-background
            >
              <label
                className="mb-stack-sm block text-xs text-muted-foreground"
                htmlFor="chrome-demo"
              >
                Hover here, or click into the field
              </label>
              <Input id="chrome-demo" placeholder="Type something…" />
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
          <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            {LEGS.map((leg, i) => (
              <div
                key={leg.label}
                className={cn("h-full rounded-full")}
                style={{
                  width: `${(leg.ms / TOTAL_MS) * 100}%`,
                  background: `rgb(var(--cl-lumen) / ${0.25 + i * 0.2})`,
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
