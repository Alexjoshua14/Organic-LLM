"use client";

import type { SpeakBudgetSnapshot } from "@/lib/speak/types";

import { glass } from "@/components/design-system/primitives";
import { speakBudgetMeter } from "@/lib/speak/speak-stage-view";
import { cn } from "@/lib/utils";

/**
 * Today's voice allowance as a glanceable bar plus minutes. The full picture (spend left,
 * per-call cap) is in the title and the accessible name, not on screen. One number to read
 * mid-call is enough.
 */
export function SpeakBudgetMeter({
  budget,
  className,
}: {
  budget: SpeakBudgetSnapshot | null;
  className?: string;
}) {
  const meter = speakBudgetMeter(budget);

  if (!meter) return null;

  const tone =
    meter.level === "exhausted"
      ? "bg-rose-400"
      : meter.level === "warn"
        ? "bg-amber-400"
        : "bg-foreground/60";

  return (
    <div
      aria-label={meter.description}
      className={cn(
        glass({ border: "all" }),
        "flex h-11 items-center gap-inline-sm rounded-full px-inset-lg text-xs tabular-nums",
        meter.level === "ok" ? "text-muted-foreground" : "text-foreground",
        className
      )}
      role="group"
      title={meter.description}
    >
      <span
        aria-hidden
        className="relative h-1.5 w-10 overflow-hidden rounded-full bg-foreground/15"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width]", tone)}
          style={{ width: `${Math.round(meter.minutesFraction * 100)}%` }}
        />
      </span>
      <span aria-hidden>{meter.label}</span>
    </div>
  );
}
