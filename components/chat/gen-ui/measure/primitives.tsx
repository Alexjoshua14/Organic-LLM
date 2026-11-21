"use client";

import type { ReactNode } from "react";
import type { MeasureTone } from "@/lib/schemas/gen-ui";

import { motion, useReducedMotion } from "framer-motion";

import { MEASURE_SPAN_REDUCED, MEASURE_SPAN_SPRING } from "./measure-timing";
import { type Domain, toPct } from "./measure-math";
import { toneClass } from "./tone";

import { formatMeasureValue } from "@/lib/schemas/gen-ui/measure";
import { cn } from "@/lib/utils";

export type { Domain } from "./measure-math";
export { makeTicks, toPct } from "./measure-math";
export { toneClass } from "./tone";

/** Shared axis surface with gridlines. Children are absolutely positioned layers. */
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
    <div className="relative h-3 overflow-hidden rounded-full bg-muted/40">
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

/** Animated span between two domain values. */
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
      className={cn("absolute inset-y-0 rounded-full", toneClass[tone], soft && "opacity-40")}
      style={{ left: `${left}%` }}
      initial={reduceMotion ? false : { width: 0 }}
      animate={{ width: `${width}%` }}
      transition={reduceMotion ? MEASURE_SPAN_REDUCED : { ...MEASURE_SPAN_SPRING, delay }}
    />
  );
}

/** Point marker on the track. */
export function Pin({ at, domain }: { at: number; domain: Domain }) {
  return (
    <span
      className="absolute inset-y-0 w-0.5 bg-foreground"
      style={{ left: `${toPct(at, domain)}%` }}
    />
  );
}

/** Tick labels under the last row. */
export function Axis({
  domain,
  ticks,
  unit,
}: {
  domain: Domain;
  ticks: number[];
  unit: string;
}) {
  return (
    <div className="relative mt-2 h-4 font-mono text-xs text-muted-foreground">
      {ticks.map((t, i) => (
        <span
          key={t}
          className={cn(
            "absolute",
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
}: {
  label: string;
  value: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
      </div>
      {children}
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </li>
  );
}
