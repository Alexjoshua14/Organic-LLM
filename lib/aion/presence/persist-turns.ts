import "server-only";

import type { UIMessage } from "ai";
import type { AionEvent } from "@/lib/schemas/aion-presence";

import { upsertMessages } from "@/data/supabase/chat";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { AION_PRESENCE_TURN_SOURCE } from "@/lib/schemas/aion-presence";

const logger = createLogger("lib/aion/presence/persist-turns.ts");

export type PersistAionPresenceTurnsDeps = {
  upsertMessages: typeof upsertMessages;
  ensureChatHasTitle: typeof ensureChatHasTitle;
  updateChatSummary: typeof updateChatSummary;
};

const defaultDeps: PersistAionPresenceTurnsDeps = {
  upsertMessages,
  ensureChatHasTitle,
  updateChatSummary,
};

export type AionPresenceTurnMetadata = {
  source: typeof AION_PRESENCE_TURN_SOURCE;
  event?: {
    id: string;
    kind: AionEvent["kind"];
    surface: string;
    label: string;
  };
  at: number;
};

export function aionPresenceEventToUIMessage(args: { id: string; event: AionEvent }): UIMessage {
  const metadata: AionPresenceTurnMetadata = {
    source: AION_PRESENCE_TURN_SOURCE,
    event: {
      id: args.event.id,
      kind: args.event.kind,
      surface: args.event.surface,
      label: args.event.label,
    },
    at: args.event.at,
  };

  return {
    id: args.id,
    role: "user",
    parts: [{ type: "text", text: `[${args.event.kind}] ${args.event.label}` }],
    metadata,
  };
}

export function aionPresenceReplyToUIMessage(args: {
  id: string;
  text: string;
  eventId: string;
  at: number;
}): UIMessage {
  const metadata: AionPresenceTurnMetadata = {
    source: AION_PRESENCE_TURN_SOURCE,
    event: undefined,
    at: args.at,
  };

  return {
    id: args.id,
    role: "assistant",
    parts: [{ type: "text", text: args.text }],
    metadata: {
      ...metadata,
      event: { id: args.eventId, kind: "callback", surface: "aion", label: "reply" },
    },
  };
}

/**
 * Writes the event (as a user turn) and optional reply to the Aion presence thread.
 * One row per statement so each gets its own `created_at` (same reasoning as Speak).
 */
export async function persistAionPresenceTurns(
  args: {
    threadId: string;
    event: AionEvent;
    eventMessageId: string;
    replyText: string | null;
    replyMessageId: string;
  },
  deps: PersistAionPresenceTurnsDeps = defaultDeps
): Promise<
  { ok: true; persisted: number; postProcess: () => Promise<void> } | { ok: false; error: string }
> {
  let persisted = 0;

  const eventMsg = aionPresenceEventToUIMessage({
    id: args.eventMessageId,
    event: args.event,
  });
  const eventResult = await deps.upsertMessages({
    chatId: args.threadId,
    messages: [eventMsg],
  });

  if (!eventResult.ok) {
    logger.error("persistAionPresenceTurns", `event upsert failed: ${eventResult.error?.message}`);

    return { ok: false, error: eventResult.error?.message ?? "Failed to persist event" };
  }

  persisted += 1;

  if (args.replyText) {
    const replyMsg = aionPresenceReplyToUIMessage({
      id: args.replyMessageId,
      text: args.replyText,
      eventId: args.event.id,
      at: Date.now(),
    });
    const replyResult = await deps.upsertMessages({
      chatId: args.threadId,
      messages: [replyMsg],
    });

    if (!replyResult.ok) {
      logger.error(
        "persistAionPresenceTurns",
        `reply upsert failed: ${replyResult.error?.message}`
      );

      return { ok: false, error: replyResult.error?.message ?? "Failed to persist reply" };
    }

    persisted += 1;
  }

  const postProcess = async () => {
    if (persisted === 0) return;

    const title = await deps.ensureChatHasTitle(args.threadId);

    if (title.error) {
      logger.warn("persistAionPresenceTurns", `title failed: ${title.error.message}`);
    }

    if (args.replyText) {
      const summary = await deps.updateChatSummary(args.threadId);

      if (summary.error) {
        logger.warn("persistAionPresenceTurns", `summary failed: ${summary.error}`);
      }
    }
  };

  return { ok: true, persisted, postProcess };
}
