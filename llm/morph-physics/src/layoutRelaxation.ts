/**
 * Hints for loosening inner max-width / max-height while the physics shell is still
 * larger than the committed target on an axis (shrinking morph).
 */
import type { Vector4 } from "./schemas/physicsSchemas";

const DEFAULT_EPSILON = 0.5;

export interface LayoutConstraintRelaxation {
  width: boolean;
  height: boolean;
}

export interface ShellLayoutInfo {
  current: Vector4;
  target: Vector4;
  settled: boolean;
  relaxation: LayoutConstraintRelaxation;
}

/**
 * When the interpolated shell (`current`) is wider or taller than the spring target by more
 * than `epsilon`, inner children with smaller max-width / max-height may look wrong unless
 * constraints are relaxed until the shell catches up.
 */
export function suggestLayoutConstraintRelaxation(
  current: Vector4,
  target: Vector4,
  options?: { epsilon?: number }
): LayoutConstraintRelaxation {
  const epsilon = options?.epsilon ?? DEFAULT_EPSILON;
  return {
    width: current.w > target.w + epsilon,
    height: current.h > target.h + epsilon,
  };
}
