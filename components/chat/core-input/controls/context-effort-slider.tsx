"use client";

import { useId } from "react";

import { useCoreInputControls } from "../core-input-context";

import {
  CONTEXT_EFFORT_BUDGETS,
  CONTEXT_EFFORT_LEVELS,
  contextEffortFromIndex,
  contextEffortToIndex,
  type ContextEffortLevel,
} from "@/lib/memory/context-effort";
import { cn } from "@/lib/utils";

const MOSAIC_TILES = [
  { x: 21, y: 21, level: 0 },
  { x: 13, y: 13, level: 0 },
  { x: 29, y: 29, level: 0 },
  { x: 21, y: 13, level: 1 },
  { x: 13, y: 21, level: 1 },
  { x: 29, y: 21, level: 1 },
  { x: 21, y: 29, level: 1 },
  { x: 29, y: 13, level: 2 },
  { x: 13, y: 29, level: 2 },
  { x: 21, y: 5, level: 2 },
  { x: 37, y: 13, level: 2 },
  { x: 21, y: 37, level: 2 },
  { x: 5, y: 29, level: 2 },
] as const;

const MOSAIC_OPACITY = [1, 0.8, 0.65] as const;
const MOSAIC_SETTLE =
  "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out";
const MOSAIC_TILE_MOTION = "motion-safe:transition-[opacity,transform] motion-safe:ease-out";

/**
 * The native range owns input and accessibility; the mosaic is its visual thumb.
 * The 32px frame includes the label; its native 44px target stays out of layout.
 * The rail retains a 22px inset to match the native thumb's horizontal travel.
 */
export function ComposerContextEffortSlider() {
  const { contextEffort, onContextEffortChange, useCondensedLayout } = useCoreInputControls();
  const id = useId();
  const index = contextEffortToIndex(contextEffort);
  const current = CONTEXT_EFFORT_BUDGETS[contextEffort];

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 select-none flex-col justify-center rounded-md bg-background ring-1 ring-inset ring-border/50",
        "motion-safe:transition-shadow motion-safe:duration-200 hover:ring-border",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        "forced-colors:ring-0 forced-colors:outline-1 select-none",
        useCondensedLayout ? "w-18" : "w-24 sm:w-28"
      )}
    >
      <div className="relative h-5 shrink-0">
        <label className="sr-only" htmlFor={id}>
          Organic LLM context effort
        </label>
        <input
          aria-valuemax={2}
          aria-valuemin={0}
          aria-valuenow={index}
          aria-valuetext={current.name}
          className={cn(
            "peer absolute inset-x-0 top-4 z-10 m-0 h-11 w-full min-w-0 -translate-y-1/2 cursor-pointer touch-pan-y appearance-none border-0 bg-transparent p-0 opacity-0",
            "[&::-webkit-slider-runnable-track]:h-11 [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:m-0 [&::-webkit-slider-thumb]:size-11 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-0",
            "[&::-moz-range-track]:h-11 [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-thumb]:size-11 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0"
          )}
          dir="ltr"
          id={id}
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
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-5.5 inset-y-0">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/20 forced-colors:bg-[CanvasText]" />
            {CONTEXT_EFFORT_LEVELS.map((level, stop) => (
              <span
                key={level}
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground forced-colors:bg-[CanvasText]"
                style={{ left: `${stop * 50}%` }}
              />
            ))}
            <div
              className={cn("absolute inset-0", MOSAIC_SETTLE)}
              style={{ transform: `translateX(${index * 50}%)` }}
            >
              <svg
                className="absolute -left-2.5 top-0 size-5 text-foreground"
                fill="currentColor"
                focusable="false"
                viewBox="0 0 48 48"
              >
                <path className="fill-background" d="M0 1h48v46H0z" />
                {MOSAIC_TILES.map(({ x, y, level }) => {
                  const visible = index >= level;

                  return (
                    <rect
                      key={`${x}-${y}`}
                      className={cn(
                        MOSAIC_TILE_MOTION,
                        visible ? "motion-safe:duration-200" : "motion-safe:duration-150"
                      )}
                      height={6}
                      rx={1.5}
                      style={{
                        opacity: visible ? MOSAIC_OPACITY[level] : 0,
                        transform: visible
                          ? "translate(0px, 0px)"
                          : `translate(${Math.sign(21 - x) * 2}px, ${Math.sign(21 - y) * 2}px)`,
                      }}
                      width={6}
                      x={x}
                      y={y}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
      <span
        aria-hidden
        className="pointer-events-none block shrink-0 pb-0.5 text-center text-[9px] font-medium leading-[10px] text-muted-foreground select-none"
      >
        {current.name}
      </span>
    </div>
  );
}

export function contextEffortAriaLabel(level: ContextEffortLevel): string {
  return `Context effort ${CONTEXT_EFFORT_BUDGETS[level].name}`;
}
