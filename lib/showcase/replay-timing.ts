/**
 * Timing tokens for public showcase replays (Ergon board, future demos).
 * Keep values in the functional bands documented in docs/design/motion-and-text-timing.md.
 */

/** Composer lookalike typing — bottom of the 35–70ms typewriter band. */
export const REPLAY_COMPOSER_MS_PER_CHAR = 35;

/** Pause after the user bubble lands before the assistant starts. */
export const REPLAY_THINKING_PAUSE_MS = 700;

/** Assistant prose stream — word-ish tokens, matching welcome Noesis loop. */
export const REPLAY_ASSISTANT_MS_PER_TOKEN = 36;

/** Default time a tool call stays `input-streaming` before completing. */
export const REPLAY_TOOL_IN_FLIGHT_MS = 900;

/** Longer in-flight for INITIATE so the loading shell can be read. */
export const REPLAY_TOOL_INITIATE_IN_FLIGHT_MS = 1600;

/** Hold after a chapter’s assistant turn finishes before the next chapter. */
export const REPLAY_CHAPTER_PAUSE_MS = 1400;

/** Hold at the end of the session before looping. */
export const REPLAY_LOOP_HOLD_MS = 2800;

/** Brief beat after the composer finishes typing before the bubble appears. */
export const REPLAY_COMPOSER_SETTLE_MS = 280;
