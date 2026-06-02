import { Vector4, vector4 } from "../schemas/physicsSchemas";
import {
  morphCurrentState,
  SpringResult,
  SpringConfig,
} from "../schemas/springSolverSchemas";
import { MorphProperty } from "./types";
import { snapshot, applyVectorTransformToElement } from "../morphUtils";
import { solveSpringVector4 } from "../physics/springSolver";
import { magnitude, subtract } from "../morphUtils";

/**
 * Position property module for morphing position and size (Vector4).
 * Handles extraction, application, and state updates for position/size morphing.
 */
export const positionProperty: MorphProperty<Vector4> = {
  key: "position",
  schema: vector4,

  extractFromElement: (element: HTMLElement): Vector4 | undefined => {
    // Use existing snapshot function
    return snapshot(element);
  },

  applyToElement: (element: HTMLElement, value: Vector4): void => {
    // Use existing apply function
    applyVectorTransformToElement(element, value);
  },

  updateState: (
    state: morphCurrentState,
    springResult: SpringResult,
    value: Vector4
  ): void => {
    // Update position in current state
    if (!state.current.position) {
      state.current.position = { x: 0, y: 0, w: 0, h: 0 };
    }
    state.current.position = value;

    // Update velocity for position (stored in top-level velocity)
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
