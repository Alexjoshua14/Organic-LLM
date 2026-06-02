import { morphCurrentState, SpringConfig } from "../schemas/springSolverSchemas";
import { MorphProperty } from "./types";
import { solveSpring } from "../physics/springSolver";
import z from "zod";

/**
 * Schema for brightness value (0-1, where 0 is black and 1 is full brightness)
 */
const brightnessSchema = z.number().min(0).max(1).describe("Brightness (0-1)");

type Brightness = z.infer<typeof brightnessSchema>;

/**
 * Extract brightness from CSS filter or custom property
 */
function extractBrightness(element: HTMLElement): Brightness | undefined {
  const computedStyle = window.getComputedStyle(element);
  const filter = computedStyle.filter;
  
  // Try to parse brightness from filter (e.g., "brightness(0.5)")
  const match = filter.match(/brightness\(([\d.]+)\)/);
  if (match) {
    return parseFloat(match[1]);
  }
  
  // Try custom property
  const customBrightness = computedStyle.getPropertyValue("--brightness");
  if (customBrightness) {
    const parsed = parseFloat(customBrightness);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  
  // Default to 1 (full brightness) if not found
  return 1;
}

/**
 * Apply brightness to element via CSS filter or custom property
 */
function applyBrightness(element: HTMLElement, value: Brightness): void {
  // Apply via CSS filter
  const existingFilter = element.style.filter || "";
  // Remove existing brightness if present
  const filterWithoutBrightness = existingFilter.replace(/brightness\([^)]+\)/g, "").trim();
  const newFilter = filterWithoutBrightness
    ? `${filterWithoutBrightness} brightness(${value})`
    : `brightness(${value})`;
  element.style.filter = newFilter;
  
  // Also set as custom property for easier access
  element.style.setProperty("--brightness", value.toString());
}

/**
 * Solve spring physics for brightness
 */
function solveSpringBrightness(
  current: Brightness,
  target: Brightness,
  velocity: Brightness,
  config: SpringConfig,
  deltaTime: number
): { value: Brightness; velocity: Brightness } {
  const result = solveSpring(current, target, velocity, config, deltaTime);
  return {
    value: Math.max(0, Math.min(1, result.position)), // Clamp to 0-1
    velocity: result.velocity,
  };
}

/**
 * Calculate distance for brightness (for settling check)
 */
function brightnessDistance(a: Brightness, b: Brightness): number {
  return Math.abs(a - b);
}

/**
 * Brightness property module for morphing brightness.
 * Handles extraction, application, and state updates for brightness morphing.
 */
export const brightnessProperty: MorphProperty<Brightness> = {
  key: "brightness",
  schema: brightnessSchema,

  extractFromElement: (element: HTMLElement): Brightness | undefined => {
    return extractBrightness(element);
  },

  applyToElement: (element: HTMLElement, value: Brightness): void => {
    applyBrightness(element, value);
  },

  updateState: (
    state: morphCurrentState,
    springResult: unknown,
    value: Brightness
  ): void => {
    // Update brightness in current state
    if (!state.current.brightness) {
      state.current.brightness = 1;
    }
    state.current.brightness = value;
    
    // Note: Brightness velocity would need to be stored separately
    // This is a limitation we'll need to address by extending the schema
  },

  getCurrentValue: (state: morphCurrentState): Brightness | undefined => {
    return state.current.brightness as Brightness | undefined;
  },

  getTargetValue: (state: morphCurrentState): Brightness | undefined => {
    return state.target.brightness as Brightness | undefined;
  },

  setTargetValue: (state: morphCurrentState, value: Brightness): void => {
    if (!state.target.brightness) {
      state.target.brightness = 1;
    }
    state.target.brightness = value;
  },

  isSettled: (state: morphCurrentState, precision: number): boolean => {
    const current = state.current.brightness as Brightness | undefined;
    const target = state.target.brightness as Brightness | undefined;

    if (current === undefined || target === undefined) {
      return true; // If no brightness set, consider settled
    }

    const distance = brightnessDistance(current, target);
    return distance < precision;
  },

  solveSpring: (
    current: Brightness,
    target: Brightness,
    velocity: Brightness,
    config: SpringConfig,
    deltaTime: number
  ): { value: Brightness; velocity: Brightness } => {
    return solveSpringBrightness(current, target, velocity, config, deltaTime);
  },
};

