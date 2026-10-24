"use client";

import type { CSSProperties } from "react";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import {
  FrameLoop,
  ZERO_VECTOR,
  regular_spring_config,
  solveSpringVector4,
  type SpringConfig,
  type Vector4,
} from "@organic-llm/morph-physics";

import {
  formatCompactModelLabel,
  type UserComposerActivityState,
} from "@/lib/llm/auto-model-router";
import { raycastCharacterLumen, type LumenRaycastFrame } from "@/lib/lumen/raycaster-2d";
import { AUTO_RESOLVED_SONNET_MODEL_ID } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

/** Tuned spring for the composer Auto pill width/height morph. */
export const AUTO_PILL_SPRING_CONFIG: SpringConfig = {
  ...regular_spring_config,
  stiffness: 210,
  damping: 28,
  mass: 1,
  precision: 0.02,
};

const ACTIVITY_BREATH_FACTOR: Record<UserComposerActivityState, number> = {
  typing: 1.02,
  thinking: 1.03,
  reviewing: 1.0,
  idle: 1.0,
  disconnected: 0.98,
};

const FEATHERED_DARK_WELL_CSS =
  "radial-gradient(115% 110% at 50% 50%, rgba(6, 8, 10, 0.72) 0%, rgba(6, 8, 10, 0.52) 62%, rgba(6, 8, 10, 0.18) 100%)";

/**
 * Deterministic target geometry (`Vector4`) for a given model label and activity state.
 * Works both in browser layout and in JSDOM unit tests where DOM measurement returns 0.
 */
export function computeAutoPillTargetGeometry(
  label: string,
  options?: {
    condensed?: boolean;
    activityState?: UserComposerActivityState;
    measuredWidthPx?: number;
    measuredHeightPx?: number;
  }
): Vector4 {
  const clean = (label || "Sonnet 5.5").trim();
  const charWidth = options?.condensed ? 7.2 : 7.8;
  const chromePadding = options?.condensed ? 26 : 32;
  const measuredHorizontalBuffer = options?.condensed ? 18 : 22;
  const activityScale = ACTIVITY_BREATH_FACTOR[options?.activityState ?? "idle"] ?? 1;

  const estimatedWidth = Math.round((clean.length * charWidth + chromePadding) * activityScale);
  const w =
    options?.measuredWidthPx && options.measuredWidthPx > 12
      ? Math.round((options.measuredWidthPx + measuredHorizontalBuffer) * activityScale)
      : Math.max(52, Math.min(220, estimatedWidth));
  const h =
    options?.measuredHeightPx && options.measuredHeightPx > 10
      ? Math.max(22, Math.round(options.measuredHeightPx))
      : 22;

  return {
    x: 0,
    y: 0,
    w,
    h,
  };
}

export interface AutoModelLumenPillProps {
  /** Compact routed model label rendered in place of "Auto" (e.g. "Sonnet 5.5", "Opus 5.5"). */
  routedModelLabel?: string;
  /** Full catalog model name (e.g. "Claude Sonnet 5.5"). */
  routedModelFullTitle?: string;
  /** Gateway id of the routed model (while selector id remains "auto"). */
  routedModelId?: string;
  /** Current composer activity state modulating raycaster caustics & pill breathing. */
  activityState?: UserComposerActivityState;
  /** Semantic domain classification for tooltip / diagnostics. */
  domain?: string;
  /** Brief routing reason for tooltip / accessibility. */
  reason?: string;
  /** Compact composer mode. */
  condensed?: boolean;
  /** Explicit override for reduced-motion in tests. */
  reduceMotion?: boolean;
  className?: string;
}

export function AutoModelLumenPill({
  routedModelLabel,
  routedModelFullTitle = "Claude Sonnet 5.5",
  routedModelId = AUTO_RESOLVED_SONNET_MODEL_ID,
  activityState = "idle",
  domain = "none",
  reason,
  condensed = false,
  reduceMotion: reduceMotionProp,
  className,
}: AutoModelLumenPillProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = reduceMotionProp ?? Boolean(prefersReducedMotion);

  const displayLabel = useMemo(() => {
    const raw = routedModelLabel?.trim() || formatCompactModelLabel(routedModelFullTitle);

    if (!raw || raw.toLowerCase() === "auto") {
      return formatCompactModelLabel(routedModelFullTitle);
    }

    return raw;
  }, [routedModelLabel, routedModelFullTitle]);

  const elementRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const hasSeededPhysicsRef = useRef(false);
  const currentGeomRef = useRef<Vector4>({ ...ZERO_VECTOR });
  const targetGeomRef = useRef<Vector4>({ ...ZERO_VECTOR });
  const velocityRef = useRef<Vector4>({ ...ZERO_VECTOR });
  const frameLoopRef = useRef<FrameLoop | null>(null);

  const applyGeometryToElement = useCallback((geom: Vector4) => {
    const el = elementRef.current;

    if (!el) return;
    el.style.width = `${geom.w.toFixed(2)}px`;
    el.style.height = `${geom.h.toFixed(2)}px`;
  }, []);

  const reset = useCallback(
    (nextTarget: Vector4) => {
      frameLoopRef.current?.stop();
      currentGeomRef.current = { ...nextTarget };
      targetGeomRef.current = { ...nextTarget };
      velocityRef.current = { ...ZERO_VECTOR };
      applyGeometryToElement(nextTarget);
    },
    [applyGeometryToElement]
  );

  const morphTo = useCallback((nextTarget: Vector4) => {
    targetGeomRef.current = { ...nextTarget };
    frameLoopRef.current?.start();
  }, []);

  useEffect(() => {
    const loop = new FrameLoop(({ deltaTime }) => {
      const cur = currentGeomRef.current;
      const tgt = targetGeomRef.current;
      const vel = velocityRef.current;

      const stepped = solveSpringVector4(cur, tgt, vel, AUTO_PILL_SPRING_CONFIG, deltaTime);

      currentGeomRef.current = stepped.position;
      velocityRef.current = stepped.velocity;
      applyGeometryToElement(stepped.position);

      const posErr = Math.abs(stepped.position.w - tgt.w) + Math.abs(stepped.position.h - tgt.h);
      const velMag = Math.abs(stepped.velocity.w) + Math.abs(stepped.velocity.h);

      if (
        posErr <= AUTO_PILL_SPRING_CONFIG.precision &&
        velMag <= AUTO_PILL_SPRING_CONFIG.precision
      ) {
        currentGeomRef.current = { ...tgt };
        velocityRef.current = { ...ZERO_VECTOR };
        applyGeometryToElement(tgt);
        loop.stop();
      }
    });

    frameLoopRef.current = loop;

    return () => {
      loop.stop();
      frameLoopRef.current = null;
    };
  }, [applyGeometryToElement]);

  const targetGeometry = useMemo(
    () =>
      computeAutoPillTargetGeometry(displayLabel, {
        condensed,
        activityState,
      }),
    [displayLabel, condensed, activityState]
  );

  // Drive MorphPhysics width/height transitions as the routed model title or activity state shifts
  const syncMeasuredTargetGeometry = useCallback(
    (forceReset = false) => {
      const measuredRect = measureRef.current?.getBoundingClientRect();
      const nextTarget = computeAutoPillTargetGeometry(displayLabel, {
        condensed,
        activityState,
        measuredWidthPx: measuredRect?.width,
        measuredHeightPx: measuredRect?.height,
      });

      if (forceReset || shouldReduceMotion || !hasSeededPhysicsRef.current) {
        hasSeededPhysicsRef.current = true;
        reset(nextTarget);

        return;
      }

      morphTo(nextTarget);
    },
    [displayLabel, condensed, activityState, shouldReduceMotion, reset, morphTo]
  );

  useLayoutEffect(() => {
    syncMeasuredTargetGeometry();
  }, [syncMeasuredTargetGeometry]);

  useEffect(() => {
    const measuredEl = measureRef.current;

    if (!measuredEl) return;

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncMeasuredTargetGeometry();
      });
      observer.observe(measuredEl);
    }

    let cancelled = false;

    if (typeof document !== "undefined" && "fonts" in document && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) {
          syncMeasuredTargetGeometry();
        }
      });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [syncMeasuredTargetGeometry]);

  // Compute 2D signed-distance raycaster per-character lumen and backdrop caustics
  const lumenFrame = useMemo<LumenRaycastFrame>(() => {
    return raycastCharacterLumen({
      text: displayLabel,
      pillWidth: targetGeometry.w,
      pillHeight: targetGeometry.h,
      cornerRadius: 7,
      rayCount: 16,
      activityState,
    });
  }, [displayLabel, targetGeometry.w, targetGeometry.h, activityState]);

  const pillStyle = useMemo<CSSProperties>(
    () => ({
      ...(lumenFrame.cssVars as unknown as CSSProperties),
      width: `${targetGeometry.w}px`,
      height: `${targetGeometry.h}px`,
      backgroundImage: `${lumenFrame.backdropCausticCss}, ${FEATHERED_DARK_WELL_CSS}, ${lumenFrame.borderSheenCss}`,
    }),
    [lumenFrame, targetGeometry.w, targetGeometry.h]
  );

  return (
    <div
      ref={elementRef}
      aria-label={`Auto model routed to ${routedModelFullTitle}`}
      className={cn(
        "auto-model-lumen-pill relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[7px] py-0.5",
        condensed ? "px-2" : "px-2.5",
        "border border-white/[0.07] bg-transparent text-xs font-medium tracking-tight text-foreground/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        className
      )}
      data-activity-state={activityState}
      data-domain={domain}
      data-lumen-kernel={lumenFrame.kernel}
      data-model-id="auto"
      data-reduced-motion={shouldReduceMotion ? "true" : "false"}
      data-routed-model-id={routedModelId}
      data-selector-id="auto"
      data-target-height={targetGeometry.h}
      data-target-width={targetGeometry.w}
      style={pillStyle}
      title={
        reason ? `Auto → ${routedModelFullTitle} (${reason})` : `Auto → ${routedModelFullTitle}`
      }
    >
      {/* Faded black-to-transparent caustic backdrop layer */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[7px]"
        style={{
          background: lumenFrame.backdropCausticCss,
          opacity: lumenFrame.pillOpacity,
        }}
      />

      {/* Inner contents measured for natural target geometry */}
      <span
        ref={measureRef}
        className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full transition-opacity duration-200",
            activityState === "disconnected"
              ? "bg-amber-500/50 opacity-55"
              : activityState === "typing" || activityState === "thinking"
                ? "bg-[rgb(var(--lumen-rim))] opacity-95"
                : "bg-[rgb(var(--lumen))] opacity-75"
          )}
          data-auto-activity-dot={activityState}
          style={{
            boxShadow: `0 0 ${(3 + lumenFrame.meanGlow * 4).toFixed(1)}px rgb(var(--lumen-rim) / ${(0.35 + lumenFrame.meanGlow * 0.45).toFixed(2)})`,
          }}
        />
        <span className="sr-only">Auto: </span>
        <span
          aria-label={displayLabel}
          className="inline-flex items-baseline"
          data-auto-routed-title={displayLabel}
        >
          {lumenFrame.characters.map((sample) => (
            <span
              key={`${sample.charIndex}-${sample.char}`}
              className="inline-block whitespace-pre"
              data-lumen-bounce={sample.bounceIrradiance.toFixed(3)}
              data-lumen-char-index={sample.charIndex}
              data-lumen-glow={sample.glowIntensity.toFixed(3)}
              style={{
                textShadow: sample.textShadowCss,
                filter:
                  sample.hueShiftDeg !== 0
                    ? ` brightness(${(0.96 + sample.glowIntensity * 0.14).toFixed(3)})`
                    : undefined,
              }}
            >
              {sample.char}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}
