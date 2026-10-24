/**
 * Timing for sidebar session signals. Rationale and approved ranges:
 * docs/design/sidebar-session-signals.md.
 *
 * Glyph durations reach CSS as custom properties set by `SessionGlyph`, so these constants are
 * the single source of truth. The rest-beat *fraction* is a keyframe percentage in
 * `styles/SessionGlyph.css` (keyframe selectors cannot read variables) — keep it in sync with
 * {@link SESSION_GLYPH_REST_FRACTION}.
 */

/** One working cycle: motion, then a held rest. Low end of the 2–5s organic breathing band. */
export const SESSION_GLYPH_CYCLE_S = 2.4;

/**
 * Share of each cycle the glyph holds still. A rest beat reads as calm work rather than a
 * spinner — the Swiss railway clock's stop-to-go. CSS keyframes move over 0–66% and hold after.
 */
export const SESSION_GLYPH_REST_FRACTION = 1 / 3;

/** Delay between elements lighting in the cascade idiom (Strata layers, Remy cells). */
export const SESSION_GLYPH_CASCADE_STAGGER_S = 0.2;

/** Voice bars while a call is live. Faster than work cycles: this is presence, not progress. */
export const SESSION_GLYPH_LEVEL_CYCLE_S = 1.2;

/** Value and colour changes between idle and new. Micro-feedback band (NN/g ~100–200ms). */
export const SESSION_SIGNAL_SETTLE_S = 0.2;

/** A new title settling in after regeneration: opacity + blur clear. Enter band 250–400ms. */
export const SESSION_TITLE_SETTLE_S = 0.32;

/** How long a failed title regeneration explains itself before the row returns to rest. */
export const SESSION_TITLE_NOTICE_MS = 3_200;

/** Status line opening under a working row. */
export const SESSION_TRAY_ENTER_S = 0.24;

/** Status line closing. Exits faster than entrances. */
export const SESSION_TRAY_EXIT_S = 0.16;

/** Activity poll while anything is working. Same band as rabbit-hole completion polling. */
export const SESSION_ACTIVITY_POLL_WORKING_MS = 3_000;

/** Minimum gap between focus revalidations — how seen state from other devices arrives. */
export const SESSION_ACTIVITY_FOCUS_THROTTLE_MS = 15_000;

/**
 * A working marker older than this is treated as abandoned (a stream or generation step that
 * died without clearing it). Chat streams cap at 30s and rabbit-hole steps at 60s.
 */
export const SESSION_WORKING_STALE_MS = 5 * 60_000;
