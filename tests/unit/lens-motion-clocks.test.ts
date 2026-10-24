import { describe, expect, test } from "bun:test";

import {
  computeMotionClockRates,
  FIELD_CLOCK_CHANNELS,
  integrateMotionClockPhases,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/motion-clocks";
import { ALL_FIELD_NAMES } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/fieldLibrary";
import { RECIPES } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/recipes";

describe("motion clocks", () => {
  test("every field has a defined clock channel", () => {
    for (const field of ALL_FIELD_NAMES) {
      expect(FIELD_CLOCK_CHANNELS[field]).toBeDefined();
    }
  });

  test("rates increase turbulence from idle_ready to ingesting", () => {
    const idle = computeMotionClockRates(RECIPES.idle_ready);
    const ingesting = computeMotionClockRates(RECIPES.ingesting);

    expect(ingesting.turbulence).toBeGreaterThan(idle.turbulence);
    expect(ingesting.base).toBeGreaterThan(idle.base);
  });

  test("integration advances phases deterministically by dt", () => {
    const start = { base: 1, turbulence: 2, flow: 3, shape: 4 };
    const rates = { base: 2, turbulence: 3, flow: 4, shape: 5 };
    const out = integrateMotionClockPhases(start, rates, 0.5);

    expect(out).toEqual({
      base: 2,
      turbulence: 3.5,
      flow: 5,
      shape: 6.5,
    });
  });
});
