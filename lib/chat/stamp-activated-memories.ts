import type { UIMessage } from "ai";

import { updateChatMessage } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import {
  attachActivatedMemoriesToLatestUserMessage,
  withActivatedMemories,
  type ActivatedMemory,
} from "@/lib/memory/activated-thread-memories";

const logger = createLogger("lib/chat/stamp-activated-memories.ts");

/**
 * Put this turn's retrieved memories on the in-window user message, and patch the
 * already-saved row so the next turn still loads them.
 *
 * `savedUserMessage` is the row passed to `saveChat` (not a diagram-augmented copy).
 */
export async function stampTurnWithActivatedMemories(params: {
  chatId: string;
  validatedMessages: UIMessage[];
  savedUserMessage: UIMessage;
  activatedMemories: ActivatedMemory[] | undefined;
  userMessageSave: Promise<unknown>;
  /** Queued turns pass the Supabase user id so the update uses the admin client. */
  ownerId?: string;
}): Promise<UIMessage[]> {
  const memories = params.activatedMemories ?? [];
  const stamped = attachActivatedMemoriesToLatestUserMessage(params.validatedMessages, memories);

  if (memories.length === 0) return stamped;

  const persisted = withActivatedMemories(params.savedUserMessage, memories);

  try {
    await params.userMessageSave;
    const result = await updateChatMessage({
      chatId: params.chatId,
      message: persisted,
      ownerId: params.ownerId,
    });

    if (!result.ok) {
      logger.error(
        "stampTurnWithActivatedMemories",
        result.error?.message ?? "Failed to persist activated memories"
      );
    }
  } catch (error) {
    logger.error(
      "stampTurnWithActivatedMemories",
      error instanceof Error ? error.message : String(error)
    );
  }

  return stamped;
}
