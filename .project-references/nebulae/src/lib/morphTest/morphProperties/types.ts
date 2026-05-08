import z from "zod";
import {
  morphCurrentState,
  SpringResult,
} from "../schemas/springSolverSchemas";

/**
 * Base interface for morph properties.
 * Each property module implements this interface to provide:
 * - Schema validation
 * - Element extraction
 * - DOM application
 * - State management
 */
export interface MorphProperty<T = unknown> {
  /**
   * Unique identifier for this property (e.g., "position", "color", "brightness")
   */
  key: string;

  /**
   * Zod schema for validating this property's value
   */
  schema: z.ZodTypeAny;

  /**
   * Extract the current value of this property from a DOM element
   * @param element - The element to extract from
   * @returns The current value or undefined if not present
   */
  extractFromElement: (element: HTMLElement) => T | undefined;

  /**
   * Apply the property value to a DOM element
   * @param element - The element to apply to
   * @param value - The value to apply
   */
  applyToElement: (element: HTMLElement, value: T) => void;

  /**
   * Update the morph state with a new value from spring physics
   * @param state - The current morph state
   * @param springResult - The spring physics result (may contain property-specific data)
   * @param value - The new value to set
   */
  updateState: (
    state: morphCurrentState,
    springResult: SpringResult,
    value: T
  ) => void;

  /**
   * Get the current value from the morph state
   * @param state - The morph state
   * @returns The current value or undefined
   */
  getCurrentValue: (state: morphCurrentState) => T | undefined;

  /**
   * Get the target value from the morph state
   * @param state - The morph state
   * @returns The target value or undefined
   */
  getTargetValue: (state: morphCurrentState) => T | undefined;

  /**
   * Set the target value in the morph state
   * @param state - The morph state
   * @param value - The target value to set
   */
  setTargetValue: (state: morphCurrentState, value: T) => void;

  /**
   * Check if this property has settled (reached target with minimal velocity)
   * @param state - The morph state
   * @param precision - The precision threshold
   * @returns true if settled, false otherwise
   */
  isSettled?: (state: morphCurrentState, precision: number) => boolean;

  /**
   * Solve spring physics for this property
   * @param current - Current value
   * @param target - Target value
   * @param velocity - Current velocity (type depends on property)
   * @param config - Spring configuration
   * @param deltaTime - Time delta in milliseconds
   * @returns The new value and velocity after spring physics
   */
  solveSpring?: (
    current: T,
    target: T,
    velocity: any,
    config: any,
    deltaTime: number
  ) => { value: T; velocity: any };
}
