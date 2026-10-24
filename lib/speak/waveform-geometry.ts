import type { VoiceWaveDriver } from "@/components/voice/voice-live-bar-timing";

import {
  VOICE_WAVE_AMPLITUDE_USE,
  VOICE_WAVE_CONTROL_POINTS,
  VOICE_WAVE_DRIFT_SPEED,
  VOICE_WAVE_DRIVER_OPACITY,
  VOICE_WAVE_DRIVERS,
  VOICE_WAVE_EDGE_PADDING_PX,
  VOICE_WAVE_IDLE_USE,
  VOICE_WAVE_INTERPOLATION_STEPS,
  VOICE_WAVE_MID_OPACITY,
} from "@/components/voice/voice-live-bar-timing";

/**
 * Ribbon geometry for the live voice bar.
 *
 * ## The idea, from the reference art
 *
 * A ribbon is not a shape with an outline. It is a *band* of many thin strokes interpolated
 * between two wandering driver curves. Where the drivers converge the strokes pack and read as
 * solid light; where they spread you see the individual lines and the moiré between them. So
 * every interpolated curve is stroked — they are the render, not scaffolding.
 *
 * ## What the drivers mean
 *
 * Three real audio dimensions — volume, treble, bass — in that fixed adjacency order. Each has a
 * fixed spatial *basis* (a couple of harmonics across the width) whose amplitude its audio level
 * modulates, plus slow time drift so the ribbon breathes during silence. Baselines are spread
 * monotonically in render order, so the two bands stack into one coherent ribbon instead of
 * folding through each other.
 *
 * Pure and frame-independent: everything is a function of `(levels, seconds, width, height)`.
 */

type Harmonic = { freq: number; amp: number; phase: number };

/**
 * Per-driver shape. `freq` is cycles across the full width. Two harmonics each: one that sets
 * the gross wander and one that keeps it from reading as a plain sine.
 *
 * Amplitudes here are *relative weights*; {@link normalizeBasis} rescales each driver so its
 * harmonics sum to exactly 1. Without that, a driver's combined offset can exceed ±1 (these
 * weights sum to 1.34, 1.12 and 1.28) and every amplitude budget downstream is wrong.
 */
const DRIVER_BASIS_WEIGHTS: Record<VoiceWaveDriver, Harmonic[]> = {
  volume: [
    { freq: 1.0, amp: 1.0, phase: 0 },
    { freq: 2.3, amp: 0.34, phase: 1.7 },
  ],
  treble: [
    { freq: 2.1, amp: 0.82, phase: 0.9 },
    { freq: 4.7, amp: 0.3, phase: 2.4 },
  ],
  bass: [
    { freq: 0.7, amp: 1.0, phase: 2.2 },
    { freq: 1.6, amp: 0.28, phase: 0.4 },
  ],
};

function normalizeBasis(harmonics: Harmonic[]): Harmonic[] {
  const total = harmonics.reduce((sum, h) => sum + Math.abs(h.amp), 0) || 1;

  return harmonics.map((h) => ({ ...h, amp: h.amp / total }));
}

/** Offset from any driver is now guaranteed to lie in [-1, 1]. */
const DRIVER_BASIS: Record<VoiceWaveDriver, Harmonic[]> = {
  volume: normalizeBasis(DRIVER_BASIS_WEIGHTS.volume),
  treble: normalizeBasis(DRIVER_BASIS_WEIGHTS.treble),
  bass: normalizeBasis(DRIVER_BASIS_WEIGHTS.bass),
};

/** Rest position as a fraction of bar height, monotonic in render order. */
const DRIVER_BASELINE: Record<VoiceWaveDriver, number> = {
  volume: 0.24,
  treble: 0.5,
  bass: 0.76,
};

/**
 * How far any curve may swing from its baseline without leaving the viewBox.
 *
 * Only the outermost baselines can clip — interpolated curves are bounded by the drivers they sit
 * between, and the middle driver has strictly more room than both. So the budget is the smaller
 * of "distance from the top baseline to the top edge" and "distance from the bottom baseline to
 * the bottom edge", less the padding that keeps strokes off the edge.
 *
 * Deriving this rather than hardcoding it is the point: retuning {@link DRIVER_BASELINE} can
 * never silently reintroduce clipping.
 */
export function availableHeadroomPx(
  height: number,
  padding: number = VOICE_WAVE_EDGE_PADDING_PX
): number {
  const baselines = Object.values(DRIVER_BASELINE);
  const toTop = Math.min(...baselines) * height;
  const toBottom = (1 - Math.max(...baselines)) * height;

  return Math.max(0, Math.min(toTop, toBottom) - padding);
}

export type WaveLevels = Record<VoiceWaveDriver, number>;

/** One stroked path: its sampled y values and how brightly to draw it. */
export type RibbonCurve = {
  ys: number[];
  opacity: number;
};

/**
 * Samples one driver curve.
 *
 * Amplitude floors at {@link VOICE_WAVE_IDLE_USE} of the headroom so a silent session still
 * moves — a flat line reads as "disconnected", which is exactly the wrong thing for a presence
 * indicator. It ceilings at {@link VOICE_WAVE_AMPLITUDE_USE}, which is what keeps peaks inside
 * the viewBox instead of shaved flat against it.
 */
export function sampleDriverCurve(
  driver: VoiceWaveDriver,
  level: number,
  seconds: number,
  height: number,
  points: number = VOICE_WAVE_CONTROL_POINTS
): number[] {
  const basis = DRIVER_BASIS[driver];
  const baseline = DRIVER_BASELINE[driver] * height;
  const clamped = Math.max(0, Math.min(1, level));
  const use = VOICE_WAVE_IDLE_USE + clamped * (VOICE_WAVE_AMPLITUDE_USE - VOICE_WAVE_IDLE_USE);
  const amplitude = availableHeadroomPx(height) * use;
  const drift = seconds * VOICE_WAVE_DRIFT_SPEED[driver];

  const ys: number[] = new Array(points);

  for (let i = 0; i < points; i++) {
    const u = points === 1 ? 0 : i / (points - 1);
    let offset = 0;

    for (const h of basis) {
      offset += h.amp * Math.sin(2 * Math.PI * h.freq * u + h.phase + drift);
    }

    ys[i] = baseline + offset * amplitude;
  }

  return ys;
}

/**
 * Opacity for a stroke at normalized position `t` between two driver curves.
 *
 * Bright at the drivers, dimmest at the midpoint. That is what makes a band read as a ribbon
 * with edges rather than a uniform hatch.
 */
export function strokeOpacity(t: number): number {
  return (
    VOICE_WAVE_DRIVER_OPACITY +
    (VOICE_WAVE_MID_OPACITY - VOICE_WAVE_DRIVER_OPACITY) * Math.sin(Math.PI * t)
  );
}

/**
 * The full set of stroked curves for one frame: every driver, plus
 * {@link VOICE_WAVE_INTERPOLATION_STEPS} interpolations between each adjacent pair.
 *
 * Count is a compile-time constant — `drivers + (drivers - 1) * steps`. Nothing here allocates
 * per level value, so frame cost is flat regardless of how loud the conversation is.
 */
export function buildRibbonCurves(
  levels: WaveLevels,
  seconds: number,
  height: number,
  steps: number = VOICE_WAVE_INTERPOLATION_STEPS,
  points: number = VOICE_WAVE_CONTROL_POINTS
): RibbonCurve[] {
  const drivers = VOICE_WAVE_DRIVERS.map((d) =>
    sampleDriverCurve(d, levels[d], seconds, height, points)
  );

  const curves: RibbonCurve[] = [];

  for (let d = 0; d < drivers.length; d++) {
    curves.push({ ys: drivers[d]!, opacity: strokeOpacity(0) });

    const next = drivers[d + 1];

    if (!next) continue;

    const from = drivers[d]!;

    for (let k = 1; k <= steps; k++) {
      const t = k / (steps + 1);
      const ys: number[] = new Array(points);

      for (let i = 0; i < points; i++) {
        ys[i] = from[i]! + (next[i]! - from[i]!) * t;
      }

      curves.push({ ys, opacity: strokeOpacity(t) });
    }
  }

  return curves;
}

/** Total stroked paths for a given driver count and step count. */
export function ribbonCurveCount(
  driverCount: number = VOICE_WAVE_DRIVERS.length,
  steps: number = VOICE_WAVE_INTERPOLATION_STEPS
): number {
  return driverCount + Math.max(0, driverCount - 1) * steps;
}

/**
 * Catmull-Rom through the samples, emitted as cubic béziers.
 *
 * The reference curves are smooth and continuous; a polyline of 11 points at this width would
 * show its corners. Catmull-Rom interpolates *through* every sample (unlike a B-spline), so the
 * drawn curve still passes exactly through the driver values.
 *
 * `x` is uniformly spaced, so only `ys` is needed.
 */
/**
 * Two decimals, via arithmetic rather than `toFixed`.
 *
 * This runs ~950 times per frame (19 curves × 10 segments × 5 coordinates). Measured on an M-series
 * Mac, `toFixed(2)` costs 66µs per frame against 30µs here for coordinates that are identical to
 * the last digit — see the live-bar ADR. Worth the small ugliness.
 */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toSmoothPath(ys: number[], width: number): string {
  if (ys.length === 0) return "";
  if (ys.length === 1) return `M 0 ${r2(ys[0]!)} H ${r2(width)}`;

  const step = width / (ys.length - 1);
  const at = (i: number) => ys[Math.max(0, Math.min(ys.length - 1, i))]!;

  let d = `M 0 ${r2(ys[0]!)}`;

  for (let i = 0; i < ys.length - 1; i++) {
    const x0 = i * step;
    const x1 = (i + 1) * step;
    // Tangents from the neighbours, clamped at the ends so the curve does not flare off-canvas.
    const c1y = at(i) + (at(i + 1) - at(i - 1)) / 6;
    const c2y = at(i + 1) - (at(i + 2) - at(i)) / 6;
    const c1x = x0 + step / 3;
    const c2x = x1 - step / 3;

    d += ` C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(x1)} ${r2(at(i + 1))}`;
  }

  return d;
}
