/**
 * Chat route loading presence — functional wait state, not a hero scene.
 * Bands: Material enter short · organic-presence idle breath (2–5s) · exits faster than enters.
 * Docs: docs/design/motion-and-text-timing.md
 */

/** Soft settle when the loading frame first paints (Material enter short band). */
export const CHAT_PAGE_LOADING_ENTER_S = 0.28;

/** Quiet sustain breath while the thread hydrates (organic-presence idle band). */
export const CHAT_PAGE_LOADING_BREATHE_S = 3.6;

/**
 * How quickly the presence would clear if the route held an exit class.
 * Faster than enter (design backbone: exits faster than entrances).
 */
export const CHAT_PAGE_LOADING_EXIT_S = 0.18;
