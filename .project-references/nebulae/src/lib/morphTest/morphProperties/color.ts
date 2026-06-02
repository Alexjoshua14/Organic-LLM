import {
  morphCurrentState,
  SpringResult,
  SpringConfig,
  HSLASchema,
} from "../schemas/springSolverSchemas";
import { MorphProperty } from "./types";
import { solveSpring } from "../physics/springSolver";
import z from "zod";

type HSLA = z.infer<typeof HSLASchema>;

/**
 * Parse HSLA color from CSS string (e.g., "hsla(120, 50%, 50%, 0.5)")
 */
function parseHSLA(colorString: string): HSLA | undefined {
  const match = colorString.match(
    /hsla?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%?,\s*(\d+(?:\.\d+)?)%?,\s*([\d.]+)?\)/i
  );
  if (!match) return undefined;

  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
    a: match[4] ? parseFloat(match[4]) : 1,
  };
}

/**
 * Convert HSLA to CSS string
 */
function hslaToString(hsla: HSLA): string {
  return `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`;
}

/**
 * Solve spring physics for HSLA color components
 */
function solveSpringHSLA(
  current: HSLA,
  target: HSLA,
  velocity: HSLA,
  config: SpringConfig,
  deltaTime: number
): { value: HSLA; velocity: HSLA } {
  const h = solveSpring(current.h, target.h, velocity.h, config, deltaTime);
  const s = solveSpring(current.s, target.s, velocity.s, config, deltaTime);
  const l = solveSpring(current.l, target.l, velocity.l, config, deltaTime);
  const a = solveSpring(current.a, target.a, velocity.a, config, deltaTime);

  return {
    value: {
      h: h.position,
      s: s.position,
      l: l.position,
      a: a.position,
    },
    velocity: {
      h: h.velocity,
      s: s.velocity,
      l: l.velocity,
      a: a.velocity,
    },
  };
}

/**
 * Calculate magnitude/distance for HSLA (for settling check)
 */
function hslaMagnitude(a: HSLA, b: HSLA): number {
  return (
    Math.abs(a.h - b.h) +
    Math.abs(a.s - b.s) +
    Math.abs(a.l - b.l) +
    Math.abs(a.a - b.a)
  );
}

/**
 * Color property module for morphing HSLA color.
 * Handles extraction, application, and state updates for color morphing.
 */
export const colorProperty: MorphProperty<HSLA> = {
  key: "color",
  schema: HSLASchema,

  extractFromElement: (element: HTMLElement): HSLA | undefined => {
    const computedStyle = window.getComputedStyle(element);
    const bgColor = computedStyle.backgroundColor;

    // Try to parse as HSLA
    const hsla = parseHSLA(bgColor);
    if (hsla) return hsla;

    // If not HSLA, try to convert from RGB/RGBA
    // For now, return undefined if not in HSLA format
    // Could add RGB to HSLA conversion if needed
    return undefined;
  },

  applyToElement: (element: HTMLElement, value: HSLA): void => {
    element.style.backgroundColor = hslaToString(value);
  },

  updateState: (
    state: morphCurrentState,
    springResult: SpringResult,
    value: HSLA
  ): void => {
    // Update color in current state
    if (!state.current.color) {
      state.current.color = { h: 0, s: 0, l: 0, a: 1 };
    }
    state.current.color = value;

    // Note: Color velocity would need to be stored separately
    // For now, we'll handle it in the solveSpring method
  },

  getCurrentValue: (state: morphCurrentState): HSLA | undefined => {
    return state.current.color;
  },

  getTargetValue: (state: morphCurrentState): HSLA | undefined => {
    return state.target.color;
  },

  setTargetValue: (state: morphCurrentState, value: HSLA): void => {
    if (!state.target.color) {
      state.target.color = { h: 0, s: 0, l: 0, a: 1 };
    }
    state.target.color = value;
  },

  isSettled: (state: morphCurrentState, precision: number): boolean => {
    const current = state.current.color;
    const target = state.target.color;

    if (!current || !target) {
      return true; // If no color set, consider settled
    }

    const distance = hslaMagnitude(current, target);
    return distance < precision;
  },

  solveSpring: (
    current: HSLA,
    target: HSLA,
    velocity: HSLA,
    config: SpringConfig,
    deltaTime: number
  ): { value: HSLA; velocity: HSLA } => {
    return solveSpringHSLA(current, target, velocity, config, deltaTime);
  },
};
