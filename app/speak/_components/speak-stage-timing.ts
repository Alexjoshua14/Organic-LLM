/**
 * Speak stage — motion constants.
 *
 * Per `docs/design/README.md` principle 4, timing lives next to the effect. The *why* is in
 * `docs/speak/decisions/20261112-speak-stage-next.md`.
 */

/** Organic LLM's standard settle curve, shared with the live voice bar. */
export const SPEAK_STAGE_EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * Status label cross-fade. Functional motion stays brief (principle 1) and exits clear faster
 * than entrances settle (principle 2). Under reduced motion the label swaps instantly.
 */
export const SPEAK_STATUS_ENTER_MS = 220;
export const SPEAK_STATUS_EXIT_MS = 140;

/** Orb colour and resting-scale change between states. Slow enough to read as breath. */
export const SPEAK_ORB_STATE_MS = 700;

/**
 * How far the orb core swells at full voice. Small on purpose: the orb should look like it is
 * listening, not like a VU meter. 0.18 = up to 18% larger at peak volume.
 */
export const SPEAK_ORB_VOLUME_GAIN = 0.18;

/** How far the halo brightens at full voice, added to its resting opacity. */
export const SPEAK_ORB_HALO_GAIN = 0.45;

/**
 * Per-frame smoothing toward the measured level (EMA factor). Audio levels already arrive
 * smoothed; this only removes the frame-to-frame shimmer that makes a scale transform buzz.
 */
export const SPEAK_ORB_LEVEL_SMOOTHING = 0.22;

/** Transcript side panel slide. */
export const SPEAK_PANEL_ENTER_MS = 280;
export const SPEAK_PANEL_EXIT_MS = 180;

/**
 * Organic agent mark in the Speak hero (`OrganicActivityMark`). The mark was tuned for a 40px
 * chip; blown up to ~13rem with a proportional blur, its dots left about a quarter of their ink
 * after blurring, and the default idle cover (50% tint, 115% brightness) washed that to roughly
 * 11% contrast. The tile then read as empty glass with the page showing through.
 *
 * Speak keeps the blur as is and instead gives the dots more weight before it, and lets the
 * cover lighten less. Dot weight 1.8 with a 10–15% cover (inkier pass; judged by eye, not yet rendered). Material values are
 * Speak-only overrides (`glassByState`); the shared defaults in `activity-mark-glass.ts` stay put.
 */
export const SPEAK_AGENT_DOT_WEIGHT = 1.8;
export const SPEAK_AGENT_GLASS = {
  idle: { opacity: 0.12, brightness: 1 },
  working: { opacity: 0.12, brightness: 1.1 },
  waiting: { opacity: 0.15, brightness: 1 },
  blocked: { opacity: 0.1, brightness: 1.1 },
  complete: { opacity: 0.12, brightness: 1 },
} as const;
