import { describe, expect, test } from "bun:test";

import { easeInOutCubic } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/easing";
import { lerpRecipe, StateManager } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/state-manager";
import { RECIPES } from "@/app/sandbox/prototypes/memory-ingest/_lib/lens/recipes";

describe("easeInOutCubic", () => {
  test("endpoints", () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 6);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 6);
  });

  test("midpoint", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
  });
});

describe("lerpRecipe", () => {
  test("union of field keys treats missing as 0", () => {
    const a = RECIPES.idle_ready;
    const b = { fields: { curlNoise: 1 as const }, modulators: {} };

    const mid = lerpRecipe(a, b, 0.5);

    expect(mid.fields.breath).toBeCloseTo((a.fields.breath ?? 0) * 0.5, 6);
    expect(mid.fields.curlNoise).toBeCloseTo(((a.fields.curlNoise ?? 0) + 1) * 0.5, 6);
  });

  test("anisotropy lerps component-wise", () => {
    const a = { fields: {}, modulators: { anisotropy: [0, 0, 0] as [number, number, number] } };
    const b = { fields: {}, modulators: { anisotropy: [1, 2, 3] as [number, number, number] } };
    const mid = lerpRecipe(a, b, 0.5);

    expect(mid.modulators.anisotropy).toEqual([0.5, 1, 1.5]);
  });
});

describe("StateManager", () => {
  test("interruptible transition: lerps from current interpolated recipe", () => {
    const mgr = new StateManager("idle_ready");

    mgr.transitionTo("listening", 0);
    mgr.update(350);
    mgr.transitionTo("ingesting", 350);
    const settled = mgr.update(350 + 250 + 10);

    const targetBreath = RECIPES.ingesting.fields.breath ?? 0;
    const targetJitter = RECIPES.ingesting.fields.jitter ?? 0;
    expect(settled.fields.breath ?? 0).toBeCloseTo(targetBreath, 5);
    expect(settled.fields.jitter ?? 0).toBeCloseTo(targetJitter, 5);
  });

  test("isSettled respects clock argument", () => {
    const mgr = new StateManager("idle_ready");

    mgr.transitionTo("listening", 1000);
    expect(mgr.isSettled(1000)).toBe(false);
    expect(mgr.isSettled(1000 + 700)).toBe(true);
  });
});
