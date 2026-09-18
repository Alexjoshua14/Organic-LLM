"use client";

import { useCoreInputControls } from "../core-input-context";

import {
  CONTEXT_EFFORT_BUDGETS,
  CONTEXT_EFFORT_LEVELS,
  contextEffortFromIndex,
  contextEffortToIndex,
  type ContextEffortLevel,
} from "@/lib/memory/context-effort";
import { cn } from "@/lib/utils";

/**
 * Three-stop slider for Organic LLM context compilation (not model reasoning effort).
 * Native range so we do not add a slider package.
 */
export function ComposerContextEffortSlider() {
  const { contextEffort, onContextEffortChange, useCondensedLayout, showLabels } =
    useCoreInputControls();
  const index = contextEffortToIndex(contextEffort);
  const current = CONTEXT_EFFORT_BUDGETS[contextEffort];
  const showStopLabels = showLabels && !useCondensedLayout;

  return (
    <div className="flex shrink-0 flex-col justify-center">
      <div
        className={cn(
          "flex h-8 items-center rounded-md px-2 ring-1 ring-inset ring-border/50",
          "gap-inline-sm",
          "motion-safe:transition-[box-shadow] motion-safe:duration-200 hover:ring-border",
          useCondensedLayout ? "min-w-24 max-w-28" : "min-w-36 sm:min-w-44"
        )}
      >
        <label className="sr-only" htmlFor="composer-context-effort">
          Organic LLM context effort
        </label>
        <input
          aria-valuemax={2}
          aria-valuemin={0}
          aria-valuenow={index}
          aria-valuetext={current.name}
          className={cn(
            "h-8 w-full min-w-16 cursor-pointer appearance-none bg-transparent",
            "accent-foreground",
            "motion-reduce:transition-none"
          )}
          id="composer-context-effort"
          max={2}
          min={0}
          step={1}
          title={`Context effort: ${current.name}`}
          type="range"
          value={index}
          onChange={(event) => {
            const next = contextEffortFromIndex(Number(event.target.value));

            onContextEffortChange(next);
          }}
        />
        {!showStopLabels ? (
          <span className="min-w-10 truncate text-xs text-muted-foreground">{current.name}</span>
        ) : null}
      </div>
      {showStopLabels ? (
        <div
          aria-hidden
          className="mt-stack-xs flex justify-between px-2 text-[10px] leading-none text-muted-foreground"
        >
          {CONTEXT_EFFORT_LEVELS.map((level) => (
            <span key={level}>{CONTEXT_EFFORT_BUDGETS[level].name}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function contextEffortAriaLabel(level: ContextEffortLevel): string {
  return `Context effort ${CONTEXT_EFFORT_BUDGETS[level].name}`;
}
