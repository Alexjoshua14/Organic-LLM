import type { UIMessage } from "ai";

import { z } from "zod";

/** `metadata.source` stamped on every voice turn persisted to `messages`. */
export const SPEAK_TURN_SOURCE = "speak-realtime";

/** Max turns one `/transcript` request may carry; the hook flushes well below this. */
export const SPEAK_TURN_BATCH_MAX = 50;

/**
 * One completed transcript turn. The client mints `id` so retries dedupe against
 * `upsertMessages({ ignoreDuplicates: true })`; `at` orders turns flushed in one batch.
 */
export const SpeakVoiceTurnSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(8_000),
  at: z.number().int().nonnegative(),
});

export type SpeakVoiceTurn = z.infer<typeof SpeakVoiceTurnSchema>;

export type SpeakVoiceTurnMetadata = {
  source: typeof SPEAK_TURN_SOURCE;
  sessionId: string;
  at: number;
};

/** Voice turns are stored in the same `ui_message` envelope chat uses, so `loadChat` renders them. */
export function voiceTurnToUIMessage(turn: SpeakVoiceTurn, sessionId: string): UIMessage {
  const metadata: SpeakVoiceTurnMetadata = { source: SPEAK_TURN_SOURCE, sessionId, at: turn.at };

  return {
    id: turn.id,
    role: turn.role,
    parts: [{ type: "text", text: turn.text }],
    metadata,
  };
}

/** Oldest first, stable for equal timestamps. */
export function sortVoiceTurns(turns: SpeakVoiceTurn[]): SpeakVoiceTurn[] {
  return turns
    .map((turn, index) => ({ turn, index }))
    .sort((a, b) => a.turn.at - b.turn.at || a.index - b.index)
    .map(({ turn }) => turn);
}

/**
 * Drops leading assistant turns and trailing user turns so what reaches Mem0 is whole
 * exchanges — half an exchange yields fragments the fact extractor cannot anchor.
 */
export function completeExchanges(turns: SpeakVoiceTurn[]): SpeakVoiceTurn[] {
  const sorted = sortVoiceTurns(turns);
  const firstUser = sorted.findIndex((t) => t.role === "user");

  if (firstUser === -1) return [];

  let lastAssistant = -1;

  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i]!.role === "assistant") {
      lastAssistant = i;
      break;
    }
  }

  if (lastAssistant <= firstUser) return [];

  return sorted.slice(firstUser, lastAssistant + 1);
}
