import { describe, expect, test } from "bun:test";

import {
  VOICE_WAVE_DRIVER_OPACITY,
  VOICE_WAVE_DRIVERS,
  VOICE_WAVE_INTERPOLATION_STEPS,
  VOICE_WAVE_MID_OPACITY,
  VOICE_WAVE_STROKE_WIDTH,
} from "@/components/voice/voice-live-bar-timing";
import {
  availableHeadroomPx,
  buildRibbonCurves,
  ribbonCurveCount,
  sampleDriverCurve,
  strokeOpacity,
  toSmoothPath,
  type WaveLevels,
} from "@/lib/speak/waveform-geometry";

const SILENT: WaveLevels = { volume: 0, treble: 0, bass: 0 };
const LOUD: WaveLevels = { volume: 1, treble: 1, bass: 1 };

const HEIGHT = 32;

describe("ribbonCurveCount", () => {
  test("is drivers plus interpolations between each adjacent pair", () => {
    expect(ribbonCurveCount(3, 8)).toBe(3 + 2 * 8);
    expect(ribbonCurveCount(2, 4)).toBe(2 + 1 * 4);
  });

  test("a single driver has nothing to interpolate against", () => {
    expect(ribbonCurveCount(1, 8)).toBe(1);
  });

  test("defaults match the configured drivers and steps", () => {
    expect(ribbonCurveCount()).toBe(
      VOICE_WAVE_DRIVERS.length + (VOICE_WAVE_DRIVERS.length - 1) * VOICE_WAVE_INTERPOLATION_STEPS
    );
  });
});

describe("sampleDriverCurve", () => {
  test("still moves at zero level, so a silent session does not flatline", () => {
    const ys = sampleDriverCurve("volume", 0, 0, HEIGHT);
    const spread = Math.max(...ys) - Math.min(...ys);

    expect(spread).toBeGreaterThan(0);
  });

  test("swings wider as its band gets louder", () => {
    const quiet = sampleDriverCurve("bass", 0, 0, HEIGHT);
    const loud = sampleDriverCurve("bass", 1, 0, HEIGHT);

    const spreadOf = (ys: number[]) => Math.max(...ys) - Math.min(...ys);

    expect(spreadOf(loud)).toBeGreaterThan(spreadOf(quiet));
  });

  test("drivers rest at distinct baselines so the bands stack into one ribbon", () => {
    const mid = (ys: number[]) => ys.reduce((a, b) => a + b, 0) / ys.length;
    const centers = VOICE_WAVE_DRIVERS.map((d) => mid(sampleDriverCurve(d, 0, 0, HEIGHT)));

    // Monotonically increasing in render order — not merely distinct.
    expect(centers[0]!).toBeLessThan(centers[1]!);
    expect(centers[1]!).toBeLessThan(centers[2]!);
  });

  test("drifts over time, so the ribbon is alive while nobody is talking", () => {
    const t0 = sampleDriverCurve("treble", 0, 0, HEIGHT);
    const t1 = sampleDriverCurve("treble", 0, 2.5, HEIGHT);

    expect(t0).not.toEqual(t1);
  });

  test("honours the requested sample count", () => {
    expect(sampleDriverCurve("volume", 0.5, 1, HEIGHT, 5)).toHaveLength(5);
  });
});

describe("strokeOpacity", () => {
  test("is brightest at the driver curves and dimmest between them", () => {
    expect(strokeOpacity(0)).toBeCloseTo(VOICE_WAVE_DRIVER_OPACITY, 5);
    expect(strokeOpacity(1)).toBeCloseTo(VOICE_WAVE_DRIVER_OPACITY, 5);
    expect(strokeOpacity(0.5)).toBeCloseTo(VOICE_WAVE_MID_OPACITY, 5);
  });

  test("falls off monotonically toward the midpoint", () => {
    expect(strokeOpacity(0.25)).toBeLessThan(strokeOpacity(0));
    expect(strokeOpacity(0.5)).toBeLessThan(strokeOpacity(0.25));
  });
});

describe("buildRibbonCurves", () => {
  test("emits exactly the constant number of stroked paths", () => {
    expect(buildRibbonCurves(LOUD, 0, HEIGHT)).toHaveLength(ribbonCurveCount());
  });

  test("count does not depend on how loud the audio is", () => {
    expect(buildRibbonCurves(SILENT, 0, HEIGHT)).toHaveLength(
      buildRibbonCurves(LOUD, 3.2, HEIGHT).length
    );
  });

  test("interpolated curves lie between their two driver curves at every sample", () => {
    const steps = 3;
    const points = 7;
    const curves = buildRibbonCurves(LOUD, 1.4, HEIGHT, steps, points);

    // Layout is [driver0, ...steps, driver1, ...steps, driver2].
    const driverA = curves[0]!.ys;
    const driverB = curves[steps + 1]!.ys;

    for (let k = 1; k <= steps; k++) {
      const between = curves[k]!.ys;

      for (let i = 0; i < points; i++) {
        const lo = Math.min(driverA[i]!, driverB[i]!);
        const hi = Math.max(driverA[i]!, driverB[i]!);

        expect(between[i]!).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(between[i]!).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  test("interpolation is evenly spaced across the band", () => {
    const steps = 3;
    const curves = buildRibbonCurves(LOUD, 0.5, HEIGHT, steps, 3);
    const a = curves[0]!.ys[1]!;
    const b = curves[steps + 1]!.ys[1]!;

    for (let k = 1; k <= steps; k++) {
      const t = k / (steps + 1);

      expect(curves[k]!.ys[1]!).toBeCloseTo(a + (b - a) * t, 9);
    }
  });

  test("driver curves are drawn at full opacity and midpoints dimmer", () => {
    const steps = 3;
    const curves = buildRibbonCurves(LOUD, 0, HEIGHT, steps, 5);

    expect(curves[0]!.opacity).toBeCloseTo(VOICE_WAVE_DRIVER_OPACITY, 5);
    expect(curves[2]!.opacity).toBeLessThan(curves[0]!.opacity);
  });
});

describe("vertical bounds", () => {
  /** Every y across a long sweep of levels, phases and heights. */
  function extremes(height: number) {
    let lo = Infinity;
    let hi = -Infinity;

    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      for (let frame = 0; frame < 900; frame++) {
        const curves = buildRibbonCurves(
          { volume: level, treble: level, bass: level },
          frame / 47,
          height
        );

        for (const curve of curves) {
          for (const y of curve.ys) {
            if (y < lo) lo = y;
            if (y > hi) hi = y;
          }
        }
      }
    }

    return { lo, hi };
  }

  test.each([24, 32, 48, 64])("never leaves the viewBox at height %i", (height) => {
    const { lo, hi } = extremes(height);

    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(height);
  });

  test("keeps at least a half-stroke clear of both edges", () => {
    const { lo, hi } = extremes(32);
    const halfStroke = VOICE_WAVE_STROKE_WIDTH / 2;

    expect(lo).toBeGreaterThanOrEqual(halfStroke);
    expect(32 - hi).toBeGreaterThanOrEqual(halfStroke);
  });

  test("still fills most of the bar — not clipped into timidity", () => {
    const { lo, hi } = extremes(32);

    expect((hi - lo) / 32).toBeGreaterThan(0.85);
  });

  test("each driver's harmonics are normalized, so offsets stay within ±1 of baseline", () => {
    // A driver at full level must not exceed the derived headroom from its own baseline.
    const headroom = availableHeadroomPx(32);

    for (const driver of VOICE_WAVE_DRIVERS) {
      let maxDeviation = 0;

      for (let frame = 0; frame < 900; frame++) {
        const ys = sampleDriverCurve(driver, 1, frame / 47, 32);
        const rest = sampleDriverCurve(driver, 0, 0, 32);
        const baseline = rest.reduce((a, b) => a + b, 0) / rest.length;

        for (const y of ys) maxDeviation = Math.max(maxDeviation, Math.abs(y - baseline));
      }

      expect(maxDeviation).toBeLessThanOrEqual(headroom + 1e-6);
    }
  });

  test("headroom is the smaller gap between an outer baseline and its edge", () => {
    // Baselines sit at 0.24 / 0.5 / 0.76, so both outer gaps are 0.24 of the height.
    expect(availableHeadroomPx(100, 0)).toBeCloseTo(24, 6);
    expect(availableHeadroomPx(100, 4)).toBeCloseTo(20, 6);
  });

  test("headroom never goes negative, even on an absurdly short bar", () => {
    expect(availableHeadroomPx(2)).toBeGreaterThanOrEqual(0);
  });
});

describe("toSmoothPath", () => {
  test("returns an empty string for no samples", () => {
    expect(toSmoothPath([], 600)).toBe("");
  });

  test("degenerates to a straight line for a single sample", () => {
    expect(toSmoothPath([12], 600)).toBe("M 0 12 H 600");
  });

  test("emits one cubic segment per interval and starts at the first sample", () => {
    const d = toSmoothPath([4, 8, 6, 10], 600);

    expect(d.startsWith("M 0 4")).toBe(true);
    expect(d.match(/ C /g) ?? []).toHaveLength(3);
  });

  test("passes through every sample, which a B-spline would not", () => {
    const ys = [4, 20, 6, 28, 10];
    const d = toSmoothPath(ys, 400);
    // Every cubic ends on its own sample; check the on-curve endpoints.
    const endpoints = [...d.matchAll(/, [\d.]+ ([\d.]+)(?= C|$)/g)].map((m) => Number(m[1]));

    expect(endpoints).toEqual(ys.slice(1));
  });

  test("spans the full width", () => {
    const d = toSmoothPath([1, 2, 3], 600);

    expect(d).toContain("600");
  });
});
