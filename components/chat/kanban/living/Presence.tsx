"use client";

import type { Point } from "./board-dom";
import type { Ref } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  cssEase,
  LIVING_CAPTION_FADE_S,
  LIVING_PRESENCE_AFTERGLOW_S,
  LIVING_PRESENCE_GLOW_FADE_S,
  LIVING_PRESENCE_IDLE_S,
  LIVING_PRESENCE_WORKING_S,
  LIVING_SPARK_EASE_X,
  LIVING_SPARK_EASE_Y,
  LIVING_SPARK_S,
} from "./living-board-timing";

import ShinyText from "@/components/ShinyText";
import { PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S } from "@/lib/chat/processing-text-burn-timing";
import { cn } from "@/lib/utils";

/**
 * The model on the board: a slow breath at rest, a quicker brighter one while it works. The
 * glow stays inside the orb's box, so it never bleeds into the caption.
 */
export function PresenceOrb({
  working,
  caption,
  ref,
}: {
  working: boolean;
  caption?: string;
  ref?: Ref<HTMLSpanElement>;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  // Stay lit a beat after the work lands, so the spark visibly leaves the orb.
  const glowTransition = {
    transitionDuration: `${LIVING_PRESENCE_GLOW_FADE_S}s`,
    transitionDelay: working ? "0s" : `${LIVING_PRESENCE_AFTERGLOW_S}s`,
  };

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      <p aria-live="polite" className="min-w-0 truncate text-right text-[11px]">
        <AnimatePresence initial={false} mode="wait">
          {working && caption ? (
            <motion.span
              key={caption}
              animate={{ opacity: 1 }}
              className="block min-w-0 max-w-full truncate"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: LIVING_CAPTION_FADE_S }}
            >
              {reduceMotion ? (
                <span className="text-muted-foreground">{caption}</span>
              ) : (
                <ShinyText
                  as="span"
                  className="!block max-w-full truncate text-right"
                  speed={PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S}
                  text={caption}
                />
              )}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </p>
      <span ref={ref} aria-hidden className="relative grid size-5 shrink-0 place-items-center">
        <span
          className="absolute inset-1 rounded-full bg-[rgb(var(--lumen)/0.5)] blur-[4px] motion-safe:animate-pulse"
          style={{ animationDuration: `${LIVING_PRESENCE_IDLE_S}s` }}
        />
        <span
          className={cn(
            "absolute inset-0 transition-opacity",
            working ? "opacity-100" : "opacity-0"
          )}
          style={glowTransition}
        >
          <span
            className="absolute inset-0 rounded-full bg-[rgb(var(--lumen)/0.6)] blur-[6px] motion-safe:animate-pulse"
            style={{ animationDuration: `${LIVING_PRESENCE_WORKING_S}s` }}
          />
        </span>
        <span
          className={cn(
            "relative size-2 rounded-full bg-lumen transition-opacity",
            working ? "opacity-100" : "opacity-60"
          )}
          style={glowTransition}
        />
      </span>
    </div>
  );
}

const TRAIL = [
  { size: 7, opacity: 1, lag: 0 },
  { size: 5, opacity: 0.5, lag: 0.04 },
  { size: 3.5, opacity: 0.25, lag: 0.08 },
];

/**
 * Sends a spark from the orb to each target, built outside React and run through the Web
 * Animations API: it flies on the compositor, and neither launch nor landing re-renders the
 * board mid-glide. x and y ride separate wrappers with separate easing, so the path arcs.
 */
export function launchSparks(layer: HTMLElement, from: Point, targets: readonly Point[]): void {
  if (typeof layer.animate !== "function") return;

  for (const to of targets) {
    for (const dot of TRAIL) {
      const half = dot.size / 2;
      const timing = {
        duration: LIVING_SPARK_S * 1000,
        delay: dot.lag * 1000,
        fill: "both" as const,
      };
      const alongX = document.createElement("span");
      const alongY = document.createElement("span");
      const spark = document.createElement("span");

      alongX.className = "absolute left-0 top-0";
      alongY.className = "block";
      spark.className = "block rounded-full bg-lumen shadow-[0_0_10px_2px_rgb(var(--lumen)/0.75)]";
      spark.style.width = `${dot.size}px`;
      spark.style.height = `${dot.size}px`;
      alongY.append(spark);
      alongX.append(alongY);
      layer.append(alongX);

      alongX.animate(
        [
          { transform: `translateX(${from.x - half}px)` },
          { transform: `translateX(${to.x - half}px)` },
        ],
        { ...timing, easing: cssEase(LIVING_SPARK_EASE_X) }
      );
      alongY.animate(
        [
          { transform: `translateY(${from.y - half}px)` },
          { transform: `translateY(${to.y - half}px)` },
        ],
        { ...timing, easing: cssEase(LIVING_SPARK_EASE_Y) }
      );
      spark.animate(
        [
          { opacity: 0 },
          { opacity: dot.opacity, offset: 0.12 },
          { opacity: dot.opacity, offset: 0.82 },
          { opacity: 0 },
        ],
        timing
      ).onfinish = () => alongX.remove();
    }
  }
}
