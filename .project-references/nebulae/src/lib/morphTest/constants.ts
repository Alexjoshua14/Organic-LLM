/**
 * Shared constants and utilities for the morph physics system.
 *
 * Contains default spring configuration values, zero vector constant,
 * and factory functions for initializing physics state.
 */
import { SpringConfig } from "./schemas/springSolverSchemas";
import { Vector4 } from "./schemas/physicsSchemas";

//Slower
export const slow_spring_config: SpringConfig = {
  damping: 26,
  mass: 10,
  precision: 0.01,
  stiffness: 10,
};

export const regular_spring_config: SpringConfig = {
  damping: 26,
  mass: 1,
  precision: 0.01,
  stiffness: 170,
};

// Very slow, heavy, viscous movement - like molasses
export const molasses_spring_config: SpringConfig = {
  damping: 60,
  mass: 20,
  precision: 0.01,
  stiffness: 5,
};

export const DEFAULT_SPRING_CONFIG = slow_spring_config;

/**
 * Named preset mapping for spring configurations.
 * Used for preset selection in UI controls.
 */
export const SPRING_PRESETS = {
  slow: slow_spring_config,
  regular: regular_spring_config,
  molasses: molasses_spring_config,
} as const;

export type SpringPreset = keyof typeof SPRING_PRESETS;

export const ZERO_VECTOR: Vector4 = { x: 0, y: 0, w: 0, h: 0 };
