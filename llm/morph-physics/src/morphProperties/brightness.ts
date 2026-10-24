import type { morphCurrentState, SpringConfig, SpringResult } from "../schemas/springSolverSchemas";
import type { MorphProperty } from "./types";

import z from "zod";

import { solveSpring } from "../physics/springSolver";

const brightnessSchema = z.number().min(0).max(1).describe("Brightness (0-1)");

type Brightness = z.infer<typeof brightnessSchema>;

function extractBrightness(element: HTMLElement): Brightness | undefined {
  const computedStyle = window.getComputedStyle(element);
  const filter = computedStyle.filter;

  const match = filter.match(/brightness\(([\d.]+)\)/);

  if (match) {
    return parseFloat(match[1]);
  }

  const customBrightness = computedStyle.getPropertyValue("--brightness");

  if (customBrightness) {
    const parsed = parseFloat(customBrightness);

    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }

  return 1;
}

function applyBrightness(element: HTMLElement, value: Brightness): void {
  const existingFilter = element.style.filter || "";
  const filterWithoutBrightness = existingFilter.replace(/brightness\([^)]+\)/g, "").trim();
  const newFilter = filterWithoutBrightness
    ? `${filterWithoutBrightness} brightness(${value})`
    : `brightness(${value})`;

  element.style.filter = newFilter;

  element.style.setProperty("--brightness", value.toString());
}

function solveSpringBrightness(
  current: Brightness,
  target: Brightness,
  velocity: Brightness,
  config: SpringConfig,
  deltaTime: number
): { value: Brightness; velocity: Brightness } {
  const result = solveSpring(current, target, velocity, config, deltaTime);

  return {
    value: Math.max(0, Math.min(1, result.position)),
    velocity: result.velocity,
  };
}

function brightnessDistance(a: Brightness, b: Brightness): number {
  return Math.abs(a - b);
}

/** CSS filter brightness morph; not registered by default (see index). */
export const brightnessProperty: MorphProperty<Brightness> = {
  key: "brightness",
  schema: brightnessSchema,

  extractFromElement: (element: HTMLElement): Brightness | undefined => {
    return extractBrightness(element);
  },

  applyToElement: (element: HTMLElement, value: Brightness): void => {
    applyBrightness(element, value);
  },

  updateState: (state: morphCurrentState, _springResult: SpringResult, value: Brightness): void => {
    if (!state.current.brightness) {
      state.current.brightness = 1;
    }
    state.current.brightness = value;
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
      return true;
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
