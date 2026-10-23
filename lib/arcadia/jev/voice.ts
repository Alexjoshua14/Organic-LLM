/**
 * Voice replies in Arcadia Jev mode: the 30-second cap and the player's seek math.
 * Client-safe; the `voice_reply` tool and the in-chat player share these.
 */

/** v0 cap on one voice reply. The tool trims the script; the player also stops here. */
export const VOICE_REPLY_MAX_SECONDS = 30;

/** Conversational TTS runs about 150 words a minute, so 75 words fill 30 seconds. */
export const VOICE_REPLY_MAX_WORDS = 75;

/** Back / forward skip on the player. */
export const VOICE_REPLY_SKIP_SECONDS = 15;

const SENTENCE_END = /[.!?…]["')\]]?$/;

/**
 * Trims a script to `maxWords`, ending on the last full sentence that fits. When no sentence
 * ends inside the cap, cuts at the cap and adds an ellipsis.
 */
export function clampVoiceScript(
  script: string,
  maxWords: number = VOICE_REPLY_MAX_WORDS
): { script: string; truncated: boolean; words: number } {
  const normalized = script.replace(/\s+/g, " ").trim();
  const words = normalized ? normalized.split(" ") : [];

  if (words.length <= maxWords) {
    return { script: normalized, truncated: false, words: words.length };
  }

  const kept = words.slice(0, maxWords);
  let lastSentenceEnd = -1;

  for (let i = kept.length - 1; i >= 0; i--) {
    if (SENTENCE_END.test(kept[i]!)) {
      lastSentenceEnd = i;
      break;
    }
  }

  // A sentence boundary in the last third would drop too much; cut at the cap instead.
  if (lastSentenceEnd >= Math.floor(maxWords / 3)) {
    const trimmed = kept.slice(0, lastSentenceEnd + 1);

    return { script: trimmed.join(" "), truncated: true, words: trimmed.length };
  }

  return {
    script: `${kept.join(" ").replace(/[,;:\-–—]+$/, "")}…`,
    truncated: true,
    words: kept.length,
  };
}

/** Seconds the player may play: the clip length, capped at 30. Null until the length is known. */
export function voicePlayableSeconds(duration: number | null | undefined): number | null {
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return null;

  return Math.min(duration, VOICE_REPLY_MAX_SECONDS);
}

/** New position after skipping `delta` seconds, kept inside [0, playable]. */
export function skipVoicePosition(current: number, delta: number, playable: number | null): number {
  const upper = playable ?? VOICE_REPLY_MAX_SECONDS;
  const next = (Number.isFinite(current) ? current : 0) + delta;

  return Math.min(Math.max(0, next), upper);
}

/** `m:ss` for the player clock. */
export function formatVoiceClock(seconds: number | null | undefined): string {
  const total = seconds != null && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;

  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
