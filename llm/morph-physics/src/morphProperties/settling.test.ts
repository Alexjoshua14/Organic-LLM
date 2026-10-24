import type { morphCurrentState } from "../schemas/springSolverSchemas";

import { describe, it, expect } from "vitest";

import { positionProperty } from "./position";
import { morphPropertyRegistry } from "./registry";
import "./index";

function isoSettledAll(state: morphCurrentState, precision: number): boolean {
  const properties = morphPropertyRegistry.getAllProperties();

  for (const property of properties) {
    const current = property.getCurrentValue(state);
    const target = property.getTargetValue(state);

    if (current === undefined || target === undefined) {
      continue;
    }

    if (property.isSettled) {
      if (!property.isSettled(state, precision)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
}

describe("positionProperty.isSettled", () => {
  const prec = 0.01;

  it("true at target with zero velocity", () => {
    const state: morphCurrentState = {
      velocity: { x: 0, y: 0, w: 0, h: 0 },
      current: { position: { x: 10, y: 20, w: 100, h: 80 } },
      target: { position: { x: 10, y: 20, w: 100, h: 80 } },
    };

    expect(positionProperty.isSettled?.(state, prec)).toBe(true);
  });

  it("false when position offset", () => {
    const state: morphCurrentState = {
      velocity: { x: 0, y: 0, w: 0, h: 0 },
      current: { position: { x: 10, y: 20, w: 100, h: 80 } },
      target: { position: { x: 50, y: 20, w: 100, h: 80 } },
    };

    expect(positionProperty.isSettled?.(state, prec)).toBe(false);
  });

  it("false when velocity non-negligible", () => {
    const state: morphCurrentState = {
      velocity: { x: 2, y: 0, w: 0, h: 0 },
      current: { position: { x: 10, y: 20, w: 100, h: 80 } },
      target: { position: { x: 10, y: 20, w: 100, h: 80 } },
    };

    expect(positionProperty.isSettled?.(state, prec)).toBe(false);
  });
});

describe("registry settling with position-only morph state", () => {
  it("does not require color when current/target color undefined", () => {
    const state: morphCurrentState = {
      velocity: { x: 0, y: 0, w: 0, h: 0 },
      current: { position: { x: 0, y: 0, w: 10, h: 10 } },
      target: { position: { x: 0, y: 0, w: 10, h: 10 } },
    };

    expect(isoSettledAll(state, 0.01)).toBe(true);
  });

  it("still settles when only position differs from a dormant color channel", () => {
    const state: morphCurrentState = {
      velocity: { x: 0, y: 0, w: 0, h: 0 },
      current: {
        position: { x: 0, y: 0, w: 10, h: 10 },
      },
      target: {
        position: { x: 0, y: 0, w: 10, h: 10 },
      },
    };

    expect(isoSettledAll(state, 0.01)).toBe(true);
  });
});
