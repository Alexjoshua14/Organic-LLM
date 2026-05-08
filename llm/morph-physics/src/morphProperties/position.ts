import type { Vector4 } from "../schemas/physicsSchemas";
import { vector4 } from "../schemas/physicsSchemas";
import type {
  morphCurrentState,
  SpringResult,
  SpringConfig,
} from "../schemas/springSolverSchemas";
import type { MorphProperty } from "./types";
import { snapshot, applyVectorTransformToElement, magnitude, subtract } from "../morphUtils";
import { solveSpringVector4 } from "../physics/springSolver";

/** Morphs layout box: inline `transform: translate` + `width`/`height` in px. */
export const positionProperty: MorphProperty<Vector4> = {
  key: "position",
  schema: vector4,

  extractFromElement: (element: HTMLElement): Vector4 | undefined => {
    return snapshot(element);
  },

  applyToElement: (element: HTMLElement, value: Vector4): void => {
    applyVectorTransformToElement(element, value);
  },

  updateState: (
    state: morphCurrentState,
    springResult: SpringResult,
    value: Vector4
  ): void => {
    if (!state.current.position) {
      state.current.position = { x: 0, y: 0, w: 0, h: 0 };
    }
    state.current.position = value;
    state.velocity = springResult.velocity;
  },

  getCurrentValue: (state: morphCurrentState): Vector4 | undefined => {
    return state.current.position;
  },

  getTargetValue: (state: morphCurrentState): Vector4 | undefined => {
    return state.target.position;
  },

  setTargetValue: (state: morphCurrentState, value: Vector4): void => {
    if (!state.target.position) {
      state.target.position = { x: 0, y: 0, w: 0, h: 0 };
    }
    state.target.position = value;
  },

  isSettled: (state: morphCurrentState, precision: number): boolean => {
    const current = state.current.position;
    const target = state.target.position;
    const velocity = state.velocity;

    if (!current || !target) {
      return false;
    }

    const dx = magnitude(subtract(current, target));
    const dv = magnitude(velocity);
    return dx < precision && dv < precision;
  },

  solveSpring: (
    current: Vector4,
    target: Vector4,
    velocity: Vector4,
    config: SpringConfig,
    deltaTime: number
  ): { value: Vector4; velocity: Vector4 } => {
    const result = solveSpringVector4(
      current,
      target,
      velocity,
      config,
      deltaTime
    );
    return {
      value: result.position,
      velocity: result.velocity,
    };
  },
};
