"use client";

import type { ReactNode } from "react";
import type { MeasureTone } from "@/lib/schemas/gen-ui";

import { motion, useReducedMotion } from "framer-motion";

import { MEASURE_SPAN_REDUCED, MEASURE_SPAN_SPRING } from "./measure-timing";
import { type Domain, toPct } from "./measure-math";
import { toneFill } from "./tone";

import { CompositionStroke } from "@/components/design-system/composition-bar";
import { formatMeasureValue } from "@/lib/schemas/gen-ui/measure";
import { cn } from "@/lib/utils";

export type { Domain } from "./measure-math";
export { makeTicks, toPct } from "./measure-math";
export { toneClass } from "./tone";

/**
 * Shared axis with gridlines, the same height as the app's bar stroke. Not clipped, so a span's
 * glow can spill past it. Children are absolutely positioned layers.
 */
export function Track({
  domain,
  ticks,
  children,
}: {
  domain: Domain;
  ticks: number[];
  children?: ReactNode;
}) {
  return (
    <div className="relative h-1 rounded-full bg-muted/40">
      {ticks.slice(1, -1).map((t) => (
        <span
          key={t}
          className="absolute inset-y-0 w-px bg-border/60"
          style={{ left: `${toPct(t, domain)}%` }}
        />
      ))}
      {children}
    </div>
  );
}

/**
 * Animated span between two domain values, drawn with the app's one bar stroke (the context
 * usage bar's glow material), so measure bars match every other bar in the app.
 */
export function Span({
  from,
  to,
  domain,
  tone,
  delay = 0,
  soft = false,
}: {
  from: number;
  to: number;
  domain: Domain;
  tone: MeasureTone;
  delay?: number;
  soft?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const left = toPct(from, domain);
  const width = Math.max(toPct(to, domain) - left, 0.8);

  return (
    <motion.span
      className={cn("absolute inset-y-0", soft && "opacity-40")}
      style={{ left: `${left}%` }}
      initial={reduceMotion ? false : { width: 0 }}
      animate={{ width: `${width}%` }}
      transition={reduceMotion ? MEASURE_SPAN_REDUCED : { ...MEASURE_SPAN_SPRING, delay }}
    >
      <CompositionStroke className="w-full" color={toneFill[tone]} />
    </motion.span>
  );
}

/** Point estimate inside a range: a short upright mark that stands proud of the stroke. */
export function Pin({ at, domain }: { at: number; domain: Domain }) {
  return (
    <span
      className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
      style={{ left: `${toPct(at, domain)}%` }}
    />
  );
}

/** Tick labels under the last row. */
export function Axis({ domain, ticks, unit }: { domain: Domain; ticks: number[]; unit: string }) {
  return (
    <div className="relative mt-stack-sm h-4 font-mono text-xs text-muted-foreground">
      {ticks.map((t, i) => (
        <span
          key={t}
          className={cn(
            "absolute whitespace-nowrap",
            i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
          )}
          style={{ left: `${toPct(t, domain)}%` }}
        >
          {formatMeasureValue(t, unit)}
        </span>
      ))}
    </div>
  );
}

export function RowShell({
  label,
  value,
  note,
  children,
  condensed,
  estimate,
}: {
  label: string;
  value: string;
  note?: string;
  condensed?: boolean;
  estimate?: string;
  children: ReactNode;
}) {
  return (
    <li>
      <div className="mb-stack-xs flex flex-wrap items-baseline justify-between gap-x-inline-md text-foreground">
        <span className={cn("min-w-0 wrap-anywhere", condensed ? "text-xs" : "text-sm")}>
          {label}
        </span>
        <span className={cn("font-mono tabular-nums", condensed ? "text-xs" : "text-sm")}>
          {value}
          {estimate ? (
            <span className="sr-only">
              , <span>{estimate}</span>
            </span>
          ) : null}
        </span>
      </div>
      {children}
      {note ? <p className="mt-stack-xs text-xs text-muted-foreground">{note}</p> : null}
    </li>
  );
}
