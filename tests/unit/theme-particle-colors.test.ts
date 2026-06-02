import { describe, expect, test } from "bun:test";

import {
  parseCssColorToRgb01,
  PARTICLE_ALPHA_FROM_TOKEN,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/theme-particle-colors";

describe("parseCssColorToRgb01", () => {
  test("parses rgb() to 0–1 channels with alpha 1", () => {
    const out = parseCssColorToRgb01("rgb(10, 20, 30)");

    expect(out.r).toBeCloseTo(10 / 255);
    expect(out.g).toBeCloseTo(20 / 255);
    expect(out.b).toBeCloseTo(30 / 255);
    expect(out.alpha).toBe(1);
  });

  test("parses rgba() including alpha", () => {
    const out = parseCssColorToRgb01("rgba(255, 128, 0, 0.5)");

    expect(out.r).toBe(1);
    expect(out.g).toBeCloseTo(128 / 255);
    expect(out.b).toBe(0);
    expect(out.alpha).toBe(0.5);
  });

  test("clamps channel values to 0–1", () => {
    const out = parseCssColorToRgb01("rgb(300, -10, 128)");

    expect(out.r).toBe(1);
    expect(out.g).toBe(0);
    expect(out.b).toBeCloseTo(128 / 255);
  });
});

describe("PARTICLE_ALPHA_FROM_TOKEN", () => {
  test("is a positive scalar for host multiplier", () => {
    expect(PARTICLE_ALPHA_FROM_TOKEN).toBeGreaterThan(0);
    expect(PARTICLE_ALPHA_FROM_TOKEN).toBeLessThanOrEqual(1);
  });
});
