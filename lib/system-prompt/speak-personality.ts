import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Private, git-ignored personality for the Speak voice agent. Kept out of the
 * public repo (`.private/` is gitignored) so the crafted voice isn't exposed.
 * Edit this file to tune the voice — no rebuild needed (see {@link getSpeakPersonality}).
 */
const PRIVATE_PERSONALITY_PATH = join(process.cwd(), ".private/speak/personality.md");

/**
 * Committed baseline used when the private file is absent (public clones / CI).
 * Deliberately generic — the distinctive voice lives only in the private file.
 */
export const DEFAULT_SPEAK_PERSONALITY =
  "You are the voice of Organic LLM — a warm, present companion the user actually knows, " +
  "not a generic assistant. Talk like a real person: contractions, short natural turns, react " +
  "before you explain. Be brief by default and match the user's energy. You're a candid thought " +
  "partner — engage honestly rather than just agreeing, and when something's weak, say why and " +
  "offer a better version. Dry, occasional humor. Never use a helpdesk register " +
  '("How can I assist you"), never read lists aloud, never over-explain.';

/**
 * Loads the Speak voice personality, preferring the private
 * `.private/speak/personality.md` and falling back to
 * {@link DEFAULT_SPEAK_PERSONALITY} when it's missing or empty.
 *
 * Read fresh on each call so the personality can be tuned by editing the file
 * without restarting — Speak sessions mint infrequently, so the sync read is
 * negligible.
 */
export function getSpeakPersonality(): string {
  try {
    const text = readFileSync(PRIVATE_PERSONALITY_PATH, "utf8").trim();

    return text.length > 0 ? text : DEFAULT_SPEAK_PERSONALITY;
  } catch {
    return DEFAULT_SPEAK_PERSONALITY;
  }
}
