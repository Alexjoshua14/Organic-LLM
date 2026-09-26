import "server-only";

import {
  formatSessionContext,
  loadSessionContext,
  type LoadSessionContextDeps,
  type SessionContextInput,
  type SessionContextLimits,
} from "@/lib/llm/session-context";
import { estimateSpeakTokens } from "@/lib/speak/token-limit";

/**
 * Preamble budget for a resumed session. Sessions are capped at minutes, not hours, and the
 * instructions are re-read on every model turn, so the preamble is kept to roughly one page.
 * The Realtime session also runs `retention_ratio` truncation so instructions are never evicted;
 * see the session route.
 */
export const SPEAK_CONTEXT_MAX_TOKENS = 1_800;

/** Last two exchanges verbatim; older turns are represented by the summary. */
export const SPEAK_CONTEXT_RECENT_TURNS = 4;

/** Per-turn cap so one long monologue cannot spend the whole budget. */
export const SPEAK_CONTEXT_TURN_MAX_CHARS = 400;

export const SPEAK_CONTEXT_SUMMARY_MAX_CHARS = 1_600;

export const SPEAK_CONTEXT_MEMORY_LIMIT = 5;

/** Wide Mem0 fetch, then `selectMemoriesForPrompt` keeps the top scorers. */
export const SPEAK_CONTEXT_MEMORY_OVERFETCH = 12;

export type SpeakSessionContextInput = SessionContextInput;

export type LoadSpeakSessionContextDeps = LoadSessionContextDeps;

const SPEAK_LIMITS: SessionContextLimits = {
  maxTokens: SPEAK_CONTEXT_MAX_TOKENS,
  recentTurns: SPEAK_CONTEXT_RECENT_TURNS,
  turnMaxChars: SPEAK_CONTEXT_TURN_MAX_CHARS,
  summaryMaxChars: SPEAK_CONTEXT_SUMMARY_MAX_CHARS,
  memoryLimit: SPEAK_CONTEXT_MEMORY_LIMIT,
  memoryOverfetch: SPEAK_CONTEXT_MEMORY_OVERFETCH,
};

/** Recent turns and the summary only; memory needs a seed query, which they also provide. */
export async function loadSpeakSessionContext(
  args: { ownerId: string; threadId: string; memoryEnabled: boolean },
  deps?: LoadSpeakSessionContextDeps
): Promise<SpeakSessionContextInput> {
  return loadSessionContext({ ...args, limits: SPEAK_LIMITS }, deps);
}

/**
 * Renders the preamble in the order chat uses for context — summary, memories, then the
 * freshest turns — and trims to {@link SPEAK_CONTEXT_MAX_TOKENS}. Returns "" when empty.
 */
export function formatSpeakSessionContext(
  input: SpeakSessionContextInput,
  maxTokens: number = SPEAK_CONTEXT_MAX_TOKENS
): string {
  return formatSessionContext(input, {
    maxTokens,
    turnMaxChars: SPEAK_CONTEXT_TURN_MAX_CHARS,
    summaryMaxChars: SPEAK_CONTEXT_SUMMARY_MAX_CHARS,
  });
}

/** Re-export so existing Speak call sites that estimate tokens keep working. */
export { estimateSpeakTokens };
