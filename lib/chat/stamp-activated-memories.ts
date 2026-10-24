import type { UIMessage } from "ai";

import { after } from "next/server";

import { updateChatMessage } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import {
  attachActivatedMemoriesToLatestUserMessage,
  MAX_ACTIVATED_MEMORY_CHARS,
  withActivatedMemories,
  type ActivatedMemory,
} from "@/lib/memory/activated-thread-memories";
import {
  condenseActivatedMemories,
  isActivatedMemoryCondenseEnabled,
} from "@/lib/memory/condense-activated-memories";

const logger = createLogger("lib/chat/stamp-activated-memories.ts");

/**
 * Put this turn's retrieved memories on the in-window user message, and patch the
 * already-saved row so the next turn still loads them.
 *
 * Long memories are clipped on both copies so the turn never waits on an LLM. After
 * the response, they are condensed and the row is patched again; the system prompt
 * already carries the full text for this turn.
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
  let saved = false;

  try {
    await params.userMessageSave;
    const result = await updateChatMessage({
      chatId: params.chatId,
      message: persisted,
      ownerId: params.ownerId,
    });

    saved = result.ok;

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

  if (
    saved &&
    isActivatedMemoryCondenseEnabled() &&
    memories.some((memory) => memory.text.length > MAX_ACTIVATED_MEMORY_CHARS)
  ) {
    runAfterResponse(() =>
      persistCondensedMemories({
        chatId: params.chatId,
        savedUserMessage: params.savedUserMessage,
        memories,
        ownerId: params.ownerId,
      })
    );
  }

  return stamped;
}

async function persistCondensedMemories(params: {
  chatId: string;
  savedUserMessage: UIMessage;
  memories: ActivatedMemory[];
  ownerId?: string;
}): Promise<void> {
  try {
    const { memories, condensed } = await condenseActivatedMemories(params.memories);

    if (condensed === 0) return;

    const result = await updateChatMessage({
      chatId: params.chatId,
      message: withActivatedMemories(params.savedUserMessage, memories),
      ownerId: params.ownerId,
    });

    if (!result.ok) {
      logger.error(
        "persistCondensedMemories",
        result.error?.message ?? "Failed to persist condensed memories"
      );
    }
  } catch (error) {
    logger.error(
      "persistCondensedMemories",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/** Queued turns may already run inside `after()` or outside a request scope. */
function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}
