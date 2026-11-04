/**
 * CoreInput snapshot morph timing. Why these values, and the approved range, live in
 * docs/design/core-input-morph.md. CSS reads the pulse length from
 * `--core-input-morph-pulse-ms`, set from {@link CORE_INPUT_MORPH_PULSE_MS}.
 */

/** Whole morph, first sheen frame to settled. Long enough to read, short enough to ignore. */
export const CORE_INPUT_MORPH_MS = 400;

/** Sheen leads the first field change by one beat so the eye knows a change is coming. */
export const CORE_INPUT_MORPH_FIRST_STEP_MS = 40;

/** Quiet tail after the last field change, so its pulse finishes inside the morph. */
export const CORE_INPUT_MORPH_SETTLE_MS = 140;

/**
 * Playback rate after the user touches CoreInput mid-morph. The remaining steps still run
 * in order, five times faster: at most 80ms more instead of up to 400ms.
 */
export const CORE_INPUT_MORPH_FAST_FORWARD_RATE = 5;

/** Per-field highlight when its value lands. */
export const CORE_INPUT_MORPH_PULSE_MS = 220;

/**
 * Fade-in for the footer's settings controls on first load. The server can't read the saved
 * settings (they live in browser storage), so those controls render hidden and appear once the
 * client has applied them, instead of painting defaults and swapping. Brief, so it reads as
 * arrival rather than an animation; reduced motion shows them instantly.
 */
export const CORE_INPUT_SETTINGS_REVEAL_MS = 150;
