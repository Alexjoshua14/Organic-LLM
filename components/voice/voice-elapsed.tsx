"use client";

import { useEffect, useRef, useState } from "react";
import { FrameLoop, solveSpring } from "@organic-llm/morph-physics";

import {
  VOICE_GLOW_BLUR_MAX_PX,
  VOICE_GLOW_BLUR_MIN_PX,
  VOICE_GLOW_MAX,
  VOICE_GLOW_MIN,
  VOICE_GLOW_SPRING,
} from "./voice-live-bar-timing";

import { formatCapacityMinutes } from "@/lib/ergon/format";
import { cn } from "@/lib/utils";

/** How often the seconds target is recomputed. Well under a second, so no tick is ever missed. */
const TICK_POLL_MS = 250;

/** Spring is considered at rest below this, at which point the frame loop stops entirely. */
const SETTLE_EPSILON = 0.002;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type VoiceElapsedProps = {
  /** Epoch ms the conversation began. Survives reloads. */
  startedAt: number;
  className?: string;
};

/**
 * Session duration, where the *seconds* are the light rather than a number.
 *
 * Minutes read as text (`9m`, `3h 2m`) via the same formatter Ergon uses. Behind that text sits a
 * blurred duplicate of the same glyphs in Lumen warm: it brightens and spreads as the seconds
 * accumulate, then drops away at the top of each minute. The glyphs appear to be glowing out
 * from under themselves, and the minute boundary lands as a breath rather than a reset.
 *
 * ## Why a spring and not a transition
 *
 * A CSS transition between per-second steps is linear and reads mechanical — sixty even
 * increments. The spring overshoots each step slightly before settling, which is what makes the
 * light feel *fed* rather than dialled. `docs/speak/decisions/` records the measured cost.
 *
 * ## Cost control
 *
 * The frame loop runs only while the spring is in motion (~0.5s after each tick) and stops the
 * moment it settles, so the steady state between ticks is zero frames. It is also fully paused
 * when the tab is hidden, and skipped entirely under `prefers-reduced-motion`.
 */
export function VoiceElapsed({ startedAt, className }: VoiceElapsedProps) {
  const [label, setLabel] = useState(() => formatCapacityMinutes(0));
  const glowRef = useRef<HTMLSpanElement | null>(null);

  const targetRef = useRef(VOICE_GLOW_MIN);
  const positionRef = useRef(VOICE_GLOW_MIN);
  const velocityRef = useRef(0);
  const loopRef = useRef<FrameLoop | null>(null);

  // Recompute the label and the glow target from the clock. Only the target changes per second;
  // the label changes once a minute, so `setLabel` is a no-op for 59 of every 60 ticks.
  useEffect(() => {
    const reduced = prefersReducedMotion();

    const paint = (intensity: number) => {
      const el = glowRef.current;

      if (!el) return;

      const clamped = Math.max(0, Math.min(1, intensity));

      el.style.opacity = clamped.toFixed(3);
      el.style.filter = `blur(${(VOICE_GLOW_BLUR_MIN_PX + clamped * (VOICE_GLOW_BLUR_MAX_PX - VOICE_GLOW_BLUR_MIN_PX)).toFixed(2)}px)`;
    };

    const loop = new FrameLoop(({ deltaTime }) => {
      const { position, velocity } = solveSpring(
        positionRef.current,
        targetRef.current,
        velocityRef.current,
        VOICE_GLOW_SPRING,
        deltaTime
      );

      positionRef.current = position;
      velocityRef.current = velocity;
      paint(position);

      if (
        Math.abs(position - targetRef.current) < SETTLE_EPSILON &&
        Math.abs(velocity) < SETTLE_EPSILON
      ) {
        positionRef.current = targetRef.current;
        velocityRef.current = 0;
        paint(targetRef.current);
        loop.stop();
      }
    });

    loopRef.current = loop;

    const tick = () => {
      const elapsedMs = Math.max(0, Date.now() - startedAt);
      const minutes = Math.floor(elapsedMs / 60_000);
      const seconds = Math.floor(elapsedMs / 1000) % 60;

      setLabel(formatCapacityMinutes(minutes));

      const next = VOICE_GLOW_MIN + (seconds / 59) * (VOICE_GLOW_MAX - VOICE_GLOW_MIN);

      if (Math.abs(next - targetRef.current) < 1e-6) return;

      targetRef.current = next;

      if (reduced || document.hidden) {
        positionRef.current = next;
        velocityRef.current = 0;
        paint(next);

        return;
      }

      loop.start();
    };

    tick();

    const interval = setInterval(tick, TICK_POLL_MS);
    // A hidden tab should not be animating; rAF is throttled there anyway, and stopping avoids
    // a burst of catch-up integration on return.
    const onVisibility = () => {
      if (document.hidden) loop.stop();
      else tick();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      loop.stop();
      loopRef.current = null;
    };
  }, [startedAt]);

  return (
    <span
      className={cn("relative inline-flex items-center tabular-nums", className)}
      // The glow layer is decorative; the readable value is the foreground text.
      title={`Voice session running for ${label}`}
    >
      <span
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-lumen select-none"
        style={{ opacity: VOICE_GLOW_MIN }}
      >
        {label}
      </span>
      <span className="relative text-foreground/90">{label}</span>
    </span>
  );
}
