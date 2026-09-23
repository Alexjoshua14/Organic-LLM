/**
 * Timing for the living-board lab. Prototype values — promote the chosen light mode's tokens
 * alongside docs/design/motion-and-text-timing.md when it ships.
 */

import {
  REPLAY_LOOP_HOLD_MS,
  REPLAY_TOOL_IN_FLIGHT_MS,
  REPLAY_TOOL_INITIATE_IN_FLIGHT_MS,
} from "@/lib/showcase/replay-timing";

type CubicBezier = readonly [number, number, number, number];

/** CSS / Web Animations form of a cubic-bezier tuple. */
export function cssEase([x1, y1, x2, y2]: CubicBezier): string {
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}

/** Decelerating settle for one-shot light. */
export const LIVING_SETTLE_EASE: CubicBezier = [0.25, 0.46, 0.45, 0.94];

/** One-shot lumen wash on a card the model just changed (1–2s highlight-fade band). */
export const LIVING_WASH_S = 1.1;

/** Brightening of a lane that just received a card. */
export const LIVING_LANE_FLASH_S = 0.9;

/**
 * Card glide, between lanes and within one. No bounce: a card that overshoots reads as a
 * jitter once several move at once.
 */
export const LIVING_CARD_SPRING = { type: "spring", bounce: 0, duration: 0.55 } as const;

/** A new card fading in — Material's short enter band. */
export const LIVING_CARD_ENTER_S = 0.24;

/** A card turning opaque and casting a shadow as it lifts out of its lane, and settling back. */
export const LIVING_CARD_LIFT_S = 0.18;

/** Progress bar catching up to a new value. */
export const LIVING_PROGRESS_S = 0.5;

/** Lanes sliding aside as a neighbour folds or opens; trays resize on the same spring. */
export const LIVING_LANE_SPRING = { type: "spring", stiffness: 260, damping: 32 } as const;

/** Lane label crossfade: gone before the lane narrows, back once it has room. */
export const LIVING_LANE_LABEL_OUT_S = 0.12;
export const LIVING_LANE_LABEL_IN_S = 0.24;
export const LIVING_LANE_LABEL_IN_DELAY_S = 0.16;

/** Count digit roll — Material's short enter band. */
export const LIVING_COUNT_TICK_S = 0.2;

/** Breathing cycle of an Active card's lumen rim (organic-presence 2–5s band). */
export const LIVING_ACTIVE_BREATH_S = 4.5;

/** Field: bloom that spreads from a changed card. */
export const LIVING_BLOOM_S = 1.4;

/** Field: slow swell of the standing light under Active and Blocked work. */
export const LIVING_FIELD_SWELL_S = 7;

/** Presence: orb breathing at rest and while the model works (organic-presence idle / thinking). */
export const LIVING_PRESENCE_IDLE_S = 5;
export const LIVING_PRESENCE_WORKING_S = 2.5;

/** Presence: the caption swapping to what the model is doing now. */
export const LIVING_CAPTION_FADE_S = 0.2;

/** Presence: the orb stays lit this long after a change lands, so the spark visibly leaves it. */
export const LIVING_PRESENCE_AFTERGLOW_S = 0.3;
export const LIVING_PRESENCE_GLOW_FADE_S = 0.45;

/** Presence: warm light gathering under the card the model is touching. */
export const LIVING_ATTEND_FADE_S = 0.3;

/**
 * Presence: sheen across the card the model is touching. The sustain-shimmer idea, quicker than
 * its 5s because a tool call lasts about a second.
 */
export const LIVING_ATTEND_SHEEN_S = 1.6;

/** Presence: spark travel from the orb to the card it lands on; x and y ease apart to arc. */
export const LIVING_SPARK_S = 0.52;
export const LIVING_SPARK_EASE_X: CubicBezier = [0.3, 0.7, 0.4, 1];
export const LIVING_SPARK_EASE_Y: CubicBezier = [0.6, 0, 0.8, 0.5];

/** Lab driver beats: in-flight matches the showcase replay; dwell lets motion settle. */
export const LAB_IN_FLIGHT_MS = REPLAY_TOOL_IN_FLIGHT_MS;
export const LAB_INITIATE_IN_FLIGHT_MS = REPLAY_TOOL_INITIATE_IN_FLIGHT_MS;
export const LAB_STEP_MS = 2400;
export const LAB_FIRST_STEP_DELAY_MS = 600;
export const LAB_LOOP_HOLD_MS = REPLAY_LOOP_HOLD_MS;
