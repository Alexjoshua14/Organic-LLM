"use client";

import type { LightBehavior } from "./living-light";
import type { BoardChanges } from "./use-board-changes";
import type { KanbanLane } from "@/lib/kanban/board-lanes";
import type { KanbanStatus } from "@/lib/schemas/kanban";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";

import { CountTick } from "./CountTick";
import { StatusGlyph } from "./KanbanGlyphs";
import {
  LIVING_FIELD_SWELL_S,
  LIVING_LANE_FLASH_S,
  LIVING_LANE_LABEL_IN_DELAY_S,
  LIVING_LANE_LABEL_IN_S,
  LIVING_LANE_LABEL_OUT_S,
  LIVING_LANE_SPRING,
} from "./living-board-timing";
import { QuietCard } from "./QuietCard";
import { freshStamp } from "./use-board-changes";
import { useOneShot } from "./use-one-shot";

import { cn } from "@/lib/utils";

/** Field: standing light pooled under lanes whose status means something. */
const POOL_TONE: Partial<Record<KanbanStatus, string>> = {
  active: "rgb(var(--lumen) / 0.5)",
  blocked: "rgb(244 63 94 / 0.26)",
  done: "color-mix(in oklch, var(--accent) 34%, transparent)",
};

const FLASH_KEYFRAMES: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

/** Widths come from the board (`--lane-*`), so every full lane matches whatever folds. */
const LANE_WIDTH = {
  rail: "w-[var(--lane-rail)]",
  full: "w-[var(--lane-full)]",
  hold: "w-[var(--lane-hold)]",
  list: "w-full",
} as const;

/** Fade out at once; fade in once the lane has opened. */
function crossfade(visible: boolean): string {
  return visible
    ? `opacity ${LIVING_LANE_LABEL_IN_S}s ease-out ${LIVING_LANE_LABEL_IN_DELAY_S}s`
    : `opacity ${LIVING_LANE_LABEL_OUT_S}s ease-out`;
}

type LivingLaneProps = {
  lane: KanbanLane;
  behavior: LightBehavior;
  changes: BoardChanges;
  attendedId?: string;
  /**
   * `fold`: an empty lane collapses to a slim rail. `hold`: it keeps its width (the board is
   * still being set up). `list`: one headerless lane for views not split by status.
   */
  mode?: "fold" | "hold" | "list";
};

/**
 * A status lane. Only its position animates (a neighbour folding slides it aside); its width
 * changes in one step, and the tray behind the cards is a separate layer that resizes smoothly —
 * so no text is ever scaled, and a card gliding in is never stretched or clipped.
 */
export function LivingLane({
  lane,
  behavior,
  changes,
  attendedId,
  mode = "fold",
}: LivingLaneProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const flashRef = useRef<HTMLSpanElement>(null);
  const count = lane.items.length;
  const folded = mode === "fold" && count === 0;
  const size = mode === "fold" ? (folded ? "rail" : "full") : mode;
  const gained = lane.status !== undefined && changes.gainedLanes.has(lane.status);
  const pool = behavior.field && lane.status && count > 0 ? POOL_TONE[lane.status] : undefined;

  useOneShot(flashRef, behavior.laneFlash && gained ? changes.stamp : undefined, FLASH_KEYFRAMES, {
    duration: LIVING_LANE_FLASH_S * 1000,
    easing: "ease-out",
  });

  return (
    <motion.section
      aria-label={`${lane.label}, ${count} ${count === 1 ? "card" : "cards"}`}
      className={cn(
        "relative flex shrink-0 flex-col gap-2 data-[receiving]:z-10",
        LANE_WIDTH[size]
      )}
      data-kanban-lane={lane.key}
      layout="position"
      transition={LIVING_LANE_SPRING}
    >
      {mode === "list" ? null : (
        <div
          className="relative flex h-5 items-center gap-1.5 whitespace-nowrap pl-[11px] pr-1"
          title={folded ? lane.label : undefined}
        >
          {lane.status ? <StatusGlyph status={lane.status} /> : null}
          {/* Overflows a folded rail while it fades, instead of being clipped at once. */}
          <div
            className={cn(
              "flex items-center gap-1.5",
              folded
                ? "pointer-events-none absolute left-[31px] top-0 h-5 opacity-0"
                : "min-w-0 flex-1"
            )}
            style={{ transition: crossfade(!folded) }}
          >
            <h4 className="truncate text-xs font-medium text-foreground/85">{lane.label}</h4>
            <CountTick className="ml-auto text-[11px] text-muted-foreground" value={count} />
          </div>
        </div>
      )}

      <div
        className={cn("relative flex flex-1 flex-col gap-2 p-1.5", mode === "list" && "min-h-10")}
      >
        {mode === "list" ? null : (
          <motion.div
            layout
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-foreground/[0.028] dark:bg-white/[0.03]"
            style={{ borderRadius: 12 }}
            transition={LIVING_LANE_SPRING}
          />
        )}
        <AnimatePresence>
          {pool ? (
            <motion.span
              key="pool"
              aria-hidden
              animate={reduceMotion ? { opacity: 0.75 } : { opacity: [0.55, 0.95, 0.55] }}
              className="pointer-events-none absolute -inset-x-6 -top-8 h-44 blur-2xl"
              exit={{ opacity: 0, transition: { duration: 0.6 } }}
              initial={{ opacity: 0 }}
              style={{ background: `radial-gradient(closest-side, ${pool}, transparent)` }}
              transition={
                reduceMotion
                  ? { duration: 0.6 }
                  : { duration: LIVING_FIELD_SWELL_S, repeat: Infinity, ease: "easeInOut" }
              }
            />
          ) : null}
        </AnimatePresence>
        {behavior.laneFlash ? (
          <span
            ref={flashRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl bg-[rgb(var(--lumen)/0.14)] opacity-0"
          />
        ) : null}
        {lane.items.map((item) => (
          <QuietCard
            key={item.id}
            arriving={changes.moved.has(item.id)}
            attended={behavior.presence && attendedId === item.id}
            behavior={behavior}
            entering={changes.added.has(item.id)}
            freshStamp={freshStamp(changes, item.id)}
            item={item}
            showStatus={mode === "list"}
          />
        ))}
        {mode === "fold" && lane.status ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-0 top-2.5 flex w-[var(--lane-rail)] justify-center",
              folded ? "opacity-100" : "opacity-0"
            )}
            style={{ transition: crossfade(folded) }}
          >
            <span className="select-none text-[10px] tracking-wide text-muted-foreground/80 [writing-mode:vertical-rl]">
              {lane.shortLabel}
            </span>
          </span>
        ) : null}
        {mode === "hold" && count === 0 ? (
          <span
            aria-hidden
            className="h-12 rounded-lg bg-foreground/[0.035] motion-safe:animate-pulse"
          />
        ) : null}
      </div>
    </motion.section>
  );
}
