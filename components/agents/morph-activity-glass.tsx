"use client";

// @refresh reset
// Preserve velocity for runtime retargets, but discard stale instances after dev code edits.

import type { CSSProperties } from "react";
import type { AgentDotState } from "./agent-dot-grid-motion";
import type { ActivityGlassAppearance } from "./activity-mark-glass";
import type { DotPhysicsScheduler } from "./dot-physics-scheduler";
import type { GlassPose } from "./glass-morph-physics";

import { useEffect, useRef, useState } from "react";

import { dotPhysicsScheduler } from "./dot-physics-scheduler";
import { GlassMorphPhysics } from "./glass-morph-physics";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { getSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";

function materialStyle(pose: GlassPose): CSSProperties {
  return {
    "--activity-glass-blur": `${pose.blur}px`,
    "--activity-glass-opacity": `${pose.opacity * 100}%`,
    "--activity-glass-brightness": String(pose.brightness),
  } as CSSProperties;
}

function backdropFilter(pose: GlassPose): string {
  // Write the animated filter itself; keep saturation supplied by the glass primitive.
  return `blur(${pose.blur}px) brightness(${pose.brightness}) var(--tw-backdrop-saturate, saturate(1))`;
}

/** The owner selects the target; this persistent cover springs only while it is changing. */
export function MorphActivityGlass({
  state,
  appearance,
  scheduler = dotPhysicsScheduler,
  performanceId,
}: {
  state: AgentDotState;
  appearance: ActivityGlassAppearance;
  /** Shared scheduler is injectable for actual DOM delivery/lifecycle tests. */
  scheduler?: DotPhysicsScheduler;
  performanceId?: string;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const retarget = useRef<(target: ActivityGlassAppearance) => void>(() => {});
  // Keep React's initial styles stable so rerenders cannot overwrite an in-flight spring.
  const [initial] = useState(() => appearance);
  const { blur, opacity, brightness, tint } = appearance;

  useEffect(() => {
    const element = elementRef.current;

    if (!element) return;
    const physics = new GlassMorphPhysics(initial);
    let visible = false;
    let removeFrame: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;
    let motion: MediaQueryList | null = null;
    let supported = false;

    const paint = (pose: GlassPose) => {
      const style = materialStyle(pose) as Record<string, string>;

      for (const key of Object.keys(style)) element.style.setProperty(key, style[key]!);
      const filter = backdropFilter(pose);

      element.style.setProperty("backdrop-filter", filter);
      element.style.setProperty("-webkit-backdrop-filter", filter);
    };
    const stop = () => {
      removeFrame?.();
      removeFrame = null;
    };
    const sync = () => {
      let allowed = false;

      try {
        allowed =
          supported && !motion?.matches && !getSettings().lightweightMode && !scheduler.failure;
      } catch {
        // An unavailable preference store is a reason to use the static material.
      }
      if (!allowed) {
        stop();
        paint(physics.snap());
      } else if (!visible || physics.settled) {
        stop();
      } else if (!removeFrame) {
        removeFrame = scheduler.register((dt) => {
          paint(physics.step(dt));
          if (physics.settled) stop();
        }, performanceId);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === USER_SETTINGS_STORAGE_KEY || event.key === null) sync();
    };

    retarget.current = (target) => {
      physics.morphTo(target);
      element.style.setProperty("--activity-glass-tint", target.tint);
      sync();
    };
    try {
      motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      supported =
        typeof window.requestAnimationFrame === "function" &&
        typeof window.cancelAnimationFrame === "function" &&
        typeof IntersectionObserver !== "undefined";
      if (supported) {
        observer = new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting === true;
          sync();
        });
        observer.observe(element);
      }
    } catch {
      supported = false;
      observer?.disconnect();
    }
    const removeFailure = scheduler.subscribeFailure(sync);

    motion?.addEventListener("change", sync);
    window.addEventListener("organic-llm-settings", sync);
    window.addEventListener("storage", storage);
    sync();

    return () => {
      retarget.current = () => {};
      stop();
      removeFailure();
      observer?.disconnect();
      motion?.removeEventListener("change", sync);
      window.removeEventListener("organic-llm-settings", sync);
      window.removeEventListener("storage", storage);
    };
  }, [initial, scheduler, performanceId]);

  useEffect(() => {
    retarget.current({ blur, opacity, brightness, tint });
  }, [blur, opacity, brightness, tint, scheduler, performanceId]);

  return (
    <div
      ref={elementRef}
      aria-hidden
      className={cn(glass(), "pointer-events-none absolute inset-0 rounded-[inherit]")}
      data-activity-state={state}
      data-activity-layer="glass"
      style={
        {
          ...materialStyle(initial),
          backdropFilter: backdropFilter(initial),
          WebkitBackdropFilter: backdropFilter(initial),
          zIndex: 2,
          "--activity-glass-tint": initial.tint,
          backgroundColor:
            "color-mix(in oklch, var(--activity-glass-tint) var(--activity-glass-opacity), transparent)",
        } as CSSProperties
      }
    />
  );
}
