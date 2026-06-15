import type { morphCurrentState } from "./schemas/springSolverSchemas";

import { describe, it, expect } from "vitest";

import { applyMorphStateToElement, magnitude, subtract, updateMorphState } from "./morphUtils";
import { regular_spring_config } from "./constants";
import { assertVector4Near } from "./test/helpers";
import "./morphProperties/index";

function stateWithPosition(
  current: NonNullable<morphCurrentState["current"]["position"]>,
  target: NonNullable<morphCurrentState["target"]["position"]>,
  velocity = { x: 0, y: 0, w: 0, h: 0 }
): morphCurrentState {
  return {
    velocity: { ...velocity },
    current: { position: { ...current } },
    target: { position: { ...target } },
  };
}

describe("updateMorphState integration", () => {
  it("converges position toward target within precision after many fixed steps", () => {
    const config = { ...regular_spring_config, precision: 0.05 };
    const target = { x: 48, y: 24, w: 192, h: 144 };
    const state = stateWithPosition({ x: 0, y: 0, w: 100, h: 100 }, target);

    const dt = 16;
    const maxSteps = 3000;

    for (let i = 0; i < maxSteps; i++) {
      updateMorphState(state, config, dt);
      const cur = state.current.position!;
      const err = magnitude(subtract(cur, target));
      const speed = magnitude(state.velocity);

      if (err < config.precision && speed < config.precision) {
        expect(i).toBeLessThan(maxSteps);
        assertVector4Near(cur, target, 1);

        return;
      }
    }

    throw new Error(
      `did not settle: pos=${JSON.stringify(state.current.position)} vel=${JSON.stringify(state.velocity)}`
    );
  });

  it("keeps velocity components finite over aggressive morph", () => {
    const state = stateWithPosition(
      { x: -40, y: 10, w: 80, h: 60 },
      { x: 120, y: -30, w: 200, h: 100 }
    );

    for (let i = 0; i < 500; i++) {
      updateMorphState(state, regular_spring_config, 16);
      expect(Number.isFinite(state.velocity.x)).toBe(true);
      expect(Number.isFinite(state.velocity.y)).toBe(true);
      expect(Number.isFinite(state.velocity.w)).toBe(true);
      expect(Number.isFinite(state.velocity.h)).toBe(true);
    }
  });
});

describe("applyMorphStateToElement", () => {
  it("writes translate and dimensions from current position", () => {
    const el = document.createElement("div");
    const state = stateWithPosition(
      { x: 12, y: -8, w: 320, h: 48 },
      { x: 12, y: -8, w: 320, h: 48 }
    );

    applyMorphStateToElement(el, state);

    expect(el.style.transform).toBe("translate(12px, -8px)");
    expect(el.style.width).toBe("320px");
    expect(el.style.height).toBe("48px");
  });
});
