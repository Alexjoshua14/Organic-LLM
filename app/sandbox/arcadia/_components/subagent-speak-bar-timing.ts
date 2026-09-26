/**
 * Multitask Speak glass bar — motion next to the effect.
 *
 * Exits clear faster than entrances (docs/design/README.md principle 2).
 * Reduced motion snaps without the morph settle.
 */

/** Idle → connecting/live settle. */
export const SPEAK_BAR_ENTER_MS = 280;

/** Live → idle / handoff outgoing. Faster than enter. */
export const SPEAK_BAR_EXIT_MS = 160;

/** Content crossfade inside the same glass shell. */
export const SPEAK_BAR_CROSSFADE_MS = 180;

/** Brief hold so the outgoing bar is visible during a handoff. */
export const SPEAK_BAR_HANDOFF_CLOSING_MS = 180;

/** Organic settle curve — shared family with voice live bar. */
export const SPEAK_BAR_EASE = [0.25, 0.46, 0.45, 0.94] as const;
