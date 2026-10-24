import "server-only";

import { upsertMessages } from "@/data/supabase/chat";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { addLatestMessagesToMemoryForUser } from "@/lib/memory/operations";
import { getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";
import {
  completeExchanges,
  sortVoiceTurns,
  voiceTurnToUIMessage,
  type SpeakVoiceTurn,
} from "@/lib/speak/voice-turns";

const logger = createLogger("lib/speak/persist-voice-turns.ts");

export type PersistSpeakTurnsDeps = {
  getSpeakRealtimeSession: typeof getSpeakRealtimeSession;
  upsertMessages: typeof upsertMessages;
  ensureChatHasTitle: typeof ensureChatHasTitle;
  updateChatSummary: typeof updateChatSummary;
  addLatestMessagesToMemoryForUser: typeof addLatestMessagesToMemoryForUser;
};

const defaultDeps: PersistSpeakTurnsDeps = {
  getSpeakRealtimeSession,
  upsertMessages,
  ensureChatHasTitle,
  updateChatSummary,
  addLatestMessagesToMemoryForUser,
};

export type PersistSpeakTurnsResult =
  | {
      ok: true;
      threadId: string;
      persisted: number;
      /** Title, summary, and memory ingest. Run via `after()` so the response is not held. */
      postProcess: () => Promise<void>;
    }
  | { ok: false; error: string; status: 403 | 404 | 409 };

/**
 * Writes completed voice turns to the session's thread as ordinary `ui_message` rows.
 *
 * Closed sessions are still accepted: the final flush races `/end` when a tab unloads, and the
 * Redis record (owner + thread) is what authorises the write, not the connection.
 */
export async function persistSpeakVoiceTurns(
  args: { userId: string; sessionId: string; turns: SpeakVoiceTurn[]; final?: boolean },
  deps: PersistSpeakTurnsDeps = defaultDeps
): Promise<PersistSpeakTurnsResult> {
  const session = await deps.getSpeakRealtimeSession(args.sessionId);

  if (!session) {
    return { ok: false, error: "Session not found", status: 404 };
  }

  if (session.userId !== args.userId) {
    return { ok: false, error: "Session not owned by caller", status: 403 };
  }

  if (!session.threadId) {
    return { ok: false, error: "Session has no thread", status: 409 };
  }

  const threadId = session.threadId;
  const ordered = sortVoiceTurns(args.turns);
  let persisted = 0;

  // One row per statement so each gets its own `created_at`; a single batch would share the
  // transaction timestamp and `getMessages` orders by that column alone.
  for (const turn of ordered) {
    const result = await deps.upsertMessages({
      chatId: threadId,
      messages: [voiceTurnToUIMessage(turn, session.sessionId)],
    });

    if (!result.ok) {
      logger.error("persistSpeakVoiceTurns", `upsert failed: ${result.error?.message}`);
      break;
    }

    persisted += 1;
  }

  const memoryEnabled = session.memoryEnabled === true;
  const final = args.final === true;

  const postProcess = async () => {
    if (persisted === 0) return;

    const exchanges = completeExchanges(ordered.slice(0, persisted));

    if (memoryEnabled && exchanges.length > 0) {
      const added = await deps.addLatestMessagesToMemoryForUser(
        args.userId,
        exchanges.map((t) => voiceTurnToUIMessage(t, session.sessionId)),
        threadId
      );

      if (added.error) {
        logger.warn("persistSpeakVoiceTurns", `memory ingest failed: ${added.error}`);
      }
    }

    // Title and summary read stored messages, so they only make sense after the write.
    // Both helpers apply their own cadence; calling them per flush is cheap when nothing is due.
    const title = await deps.ensureChatHasTitle(threadId);

    if (title.error) {
      logger.warn("persistSpeakVoiceTurns", `title failed: ${title.error.message}`);
    }

    if (final || exchanges.length > 0) {
      const summary = await deps.updateChatSummary(threadId);

      if (summary.error) {
        logger.warn("persistSpeakVoiceTurns", `summary failed: ${summary.error}`);
      }
    }
  };

  return { ok: true, threadId, persisted, postProcess };
}
