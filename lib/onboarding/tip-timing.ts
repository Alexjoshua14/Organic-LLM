/**
 * Timing for feature tips. Approved values and the reasoning behind them live in
 * `docs/design/onboarding.md`; change both together.
 */
export const TIP_TIMING = {
  /** A route must be open this long before a tip may appear (lets layout and data settle). */
  settleMs: 1200,
  /** No pointer, key, wheel, touch, input or scroll activity for this long. */
  idleMs: 2500,
  /** Minimum gap between two automatic tips, across tabs. */
  cooldownMs: 120_000,
  /** At most this many automatic tips per rolling 24 hours, across tabs. */
  maxPerWindow: 2,
  /** How often the scheduler re-evaluates while a tip is waiting to show. */
  pollMs: 500,
  /**
   * How often a visible tip re-checks its anchor. Two failed checks in a row close it, so a layout
   * animation that briefly hides the anchor does not.
   */
  recheckMs: 1000,
  /** Entrance: opacity plus a 4px move away from the anchor. */
  enterMs: 160,
  /** Exit: opacity only, faster than the entrance. */
  exitMs: 100,
} as const;

export type TipTiming = { readonly [K in keyof typeof TIP_TIMING]: number };

/** Above page chrome and the sidebar; below the control cluster (215), sheets (220), dialogs (230). */
export const TIP_Z_INDEX_CLASS = "z-[212]";
