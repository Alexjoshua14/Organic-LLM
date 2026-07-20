/**
 * Natural-language description of how long it's been since the user last spoke
 * with a voice, used to give the Realtime agent conversational time-awareness:
 * a quick return should feel like a brief pause, a multi-day gap should feel
 * like real time has passed.
 *
 * Pure and dependency-free so it can be unit-tested at every boundary.
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Maps an elapsed duration (ms) to a short phrase that slots into a sentence
 * like "You last spoke with them {phrase}." Negative/NaN inputs clamp to 0.
 */
export function describeElapsedSinceLastTalk(elapsedMs: number): string {
  const ms = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

  if (ms < 2 * MINUTE) return "just now";
  if (ms < HOUR) return "a few minutes ago";
  if (ms < 6 * HOUR) return "a little earlier today";
  if (ms < DAY) return "earlier today";
  if (ms < 2 * DAY) return "yesterday";
  if (ms < 7 * DAY) return "a few days ago";
  if (ms < 14 * DAY) return "about a week ago";
  if (ms < 31 * DAY) return "a couple of weeks ago";
  if (ms < 365 * DAY) return "a while back";

  return "a long time ago";
}

/**
 * Convenience wrapper: describe the gap between an ISO timestamp (thread
 * `updated_at`) and now. Returns null when there's no prior timestamp (a
 * brand-new voice thread), signalling the agent to do a fresh cold-open.
 */
export function describeElapsedSinceTimestamp(
  updatedAtIso: string | null | undefined,
  now: number = Date.now()
): string | null {
  if (!updatedAtIso) return null;

  const then = Date.parse(updatedAtIso);

  if (Number.isNaN(then)) return null;

  return describeElapsedSinceLastTalk(now - then);
}
