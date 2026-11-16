/**
 * Timing and size budgets for the ⌘K launcher. Rationale and approved ranges live in
 * docs/design/launcher.md; the values live here, next to the effect.
 */

/** The surface settles in. Functional band: a switcher must never feel like waiting. */
export const LAUNCHER_ENTER_S = 0.24;

/** Exits run faster than entrances. */
export const LAUNCHER_EXIT_S = 0.16;

/** One idea card rising into place. */
export const LAUNCHER_CARD_ENTER_S = 0.22;

/** Gap between cards starting. Five cards finish inside ~0.35s total. */
export const LAUNCHER_CARD_STAGGER_S = 0.03;

/**
 * How long the in-memory resume cues stay trusted. Cards never wait on them (titles and
 * signals come from the sidebar cache); this only decides when to revalidate on open.
 */
export const LAUNCHER_CUES_TTL_MS = 60_000;

/** Reopening the launcher refreshes the thread list at most this often (the list is rate limited). */
export const LAUNCHER_LIST_REFRESH_MIN_MS = 30_000;

/** A resume cue is stored and shown at most this long, which also bounds the cache's memory. */
export const LAUNCHER_CUE_MAX_CHARS = 160;
