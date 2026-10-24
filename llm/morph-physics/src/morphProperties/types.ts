import type { morphCurrentState, SpringResult } from "../schemas/springSolverSchemas";

import z from "zod";

/**
 * Pluggable morph channel: read/write DOM + integrate one spring per frame.
 * Default registry installs `position` and `color` (see `morphProperties/index.ts`).
 */
export interface MorphProperty<T = unknown> {
  key: string;
  schema: z.ZodTypeAny;
  extractFromElement: (element: HTMLElement) => T | undefined;
  applyToElement: (element: HTMLElement, value: T) => void;
  updateState: (state: morphCurrentState, springResult: SpringResult, value: T) => void;
  getCurrentValue: (state: morphCurrentState) => T | undefined;
  getTargetValue: (state: morphCurrentState) => T | undefined;
  setTargetValue: (state: morphCurrentState, value: T) => void;
  isSettled?: (state: morphCurrentState, precision: number) => boolean;
  solveSpring?: (
    current: T,
    target: T,
    velocity: any,
    config: any,
    deltaTime: number
  ) => { value: T; velocity: any };
}
