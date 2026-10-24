"use client";

import type { Vector4 } from "@organic-llm/morph-physics";
import type { MorphLiveMetrics } from "./morph-demo-dev-hud";

import { useEffect, useRef, useState, type ReactNode } from "react";

const SAMPLE_INTERVAL_MS = 48;

/** Skip React updates when displayed numbers are stable (sub-pixel noise). */
const EPS_RECT = 0.15;
const EPS_SCALAR = 0.25;

function approxEqual(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) < eps;
}

function liveMetricsVisualEqual(
  prev: MorphLiveMetrics | null,
  next: MorphLiveMetrics | null
): boolean {
  if (prev == null && next == null) {
    return true;
  }
  if (prev == null || next == null) {
    return false;
  }
  if (prev.settled !== next.settled) {
    return false;
  }
  if (
    !approxEqual(prev.x, next.x, EPS_RECT) ||
    !approxEqual(prev.y, next.y, EPS_RECT) ||
    !approxEqual(prev.w, next.w, EPS_RECT) ||
    !approxEqual(prev.h, next.h, EPS_RECT)
  ) {
    return false;
  }
  if (prev.l1Err != null && next.l1Err != null) {
    if (!approxEqual(prev.l1Err, next.l1Err, EPS_SCALAR)) {
      return false;
    }
  } else if (prev.l1Err !== next.l1Err) {
    return false;
  }
  if (prev.l1Vel != null && next.l1Vel != null) {
    if (!approxEqual(prev.l1Vel, next.l1Vel, EPS_SCALAR)) {
      return false;
    }
  } else if (prev.l1Vel !== next.l1Vel) {
    return false;
  }

  return true;
}

export type MorphLiveMetricsSamplerProps<T extends Record<string, Vector4 | null>> = {
  elementRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  /** Kept in sync with active layout (e.g. "home" / "chat"). */
  layoutRef: React.RefObject<string>;
  /** Updated alongside parent `setMeasuredTargets` in `measureAndSync`. */
  measuredTargetsRef: React.MutableRefObject<T>;
  /** Map current layout + target map to the reference rect for error metrics. */
  resolveTarget: (layout: string, targets: T) => Vector4 | null;
  children: (live: MorphLiveMetrics | null) => ReactNode;
};

/**
 * Polls morph element vs stage geometry on a fixed interval; owns `live` metrics state so
 * parent demo shells do not re-render every tick.
 */
export function MorphLiveMetricsSampler<T extends Record<string, Vector4 | null>>({
  elementRef,
  stageRef,
  layoutRef,
  measuredTargetsRef,
  resolveTarget,
  children,
}: MorphLiveMetricsSamplerProps<T>) {
  const [live, setLive] = useState<MorphLiveMetrics | null>(null);

  const prevSampleRef = useRef<{ t: number; rect: Vector4 } | null>(null);
  const lastEmittedRef = useRef<MorphLiveMetrics | null>(null);
  const resolveTargetRef = useRef(resolveTarget);

  resolveTargetRef.current = resolveTarget;

  useEffect(() => {
    const id = setInterval(() => {
      const el = elementRef.current;
      const stage = stageRef.current;

      if (!el || !stage) {
        if (lastEmittedRef.current !== null) {
          lastEmittedRef.current = null;
          setLive(null);
        }

        return;
      }

      const er = el.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const x = er.x - sr.x;
      const y = er.y - sr.y;
      const w = er.width;
      const h = er.height;

      const lay = layoutRef.current;
      const tgt = resolveTargetRef.current(lay, measuredTargetsRef.current);

      let l1Err: number | null = null;

      if (tgt) {
        l1Err =
          Math.abs(x - tgt.x) + Math.abs(y - tgt.y) + Math.abs(w - tgt.w) + Math.abs(h - tgt.h);
      }

      const now = performance.now();
      const prev = prevSampleRef.current;

      let l1Vel: number | null = null;

      if (prev) {
        const dt = (now - prev.t) / 1000;

        if (dt > 1e-3) {
          l1Vel =
            (Math.abs(x - prev.rect.x) +
              Math.abs(y - prev.rect.y) +
              Math.abs(w - prev.rect.w) +
              Math.abs(h - prev.rect.h)) /
            dt;
        }
      }

      prevSampleRef.current = { t: now, rect: { x, y, w, h } };

      const settled =
        tgt != null && l1Err != null && l1Vel != null ? l1Err < 1.5 && l1Vel < 35 : null;

      const next: MorphLiveMetrics = { x, y, w, h, l1Err, l1Vel, settled };

      if (liveMetricsVisualEqual(lastEmittedRef.current, next)) {
        return;
      }
      lastEmittedRef.current = next;
      setLive(next);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(id);
      prevSampleRef.current = null;
      lastEmittedRef.current = null;
    };
  }, [elementRef, layoutRef, measuredTargetsRef, stageRef]);

  return <>{children(live)}</>;
}
