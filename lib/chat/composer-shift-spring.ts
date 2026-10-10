import type { SpringConfig } from "@organic-llm/morph-physics";

/**
 * Spring that settles CoreInput back into place when a layout change moves it (e.g. entering or
 * leaving the multiagent dashboard, or panels toggling). Functional motion: near critical damping
 * (critical ≈ 2·√(k·m) ≈ 39) so it settles in ~250ms with no visible bounce. Keep it brief — the
 * composer should feel anchored, not animated.
 */
export const COMPOSER_SHIFT_SPRING: SpringConfig = {
  stiffness: 380,
  damping: 36,
  mass: 1,
  precision: 0.01,
};

/** Shifts smaller than this snap instead of animating (sub-pixel layout noise). */
export const COMPOSER_SHIFT_MIN_PX = 1;
