import type { UIMessage } from "ai";

import { getMessages } from "@/data/supabase/chat";
import { selectArcadiaContextMessages } from "@/lib/chat/arcadia-token-context";
import {
  condenseArcadiaContext,
  filterCondenseCandidates,
  loadExistingThreadSummary,
} from "@/lib/llm/arcadia-context-condenser";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/api/run-arcadia-context-condensation.ts");

export type RunArcadiaContextCondensationParams = {
  chatId: string;
  modelId: string;
};

/**
 * Re-selects condensation candidates and folds older turns into the thread summary.
 * Safe to call from a background job: re-fetches thread state and skips already-summarized messages.
 */
export async function runArcadiaContextCondensation(
  params: RunArcadiaContextCondensationParams
): Promise<void> {
  const { chatId, modelId } = params;
  const startedAt = performance.now();

  const allMessagesResult = await getMessages(chatId);

  if (allMessagesResult.error || !allMessagesResult.data) {
    logger.error("runArcadiaContextCondensation", "Failed to load messages", {
      chatId,
      error: allMessagesResult.error,
    });

    return;
  }

  const allMessages = allMessagesResult.data;
  const selection = selectArcadiaContextMessages(allMessages);

  if (!selection.needsCondensation || selection.messagesToCondense.length === 0) {
    logger.log("runArcadiaContextCondensation", "No condensation needed", { chatId });

    return;
  }

  const messagesToCondense = await filterCondenseCandidates({
    chatId,
    allMessages,
    messagesToCondense: selection.messagesToCondense,
  });

  if (messagesToCondense.length === 0) {
    logger.log("runArcadiaContextCondensation", "Condensation already up to date", { chatId });

    return;
  }

  const existingSummary = await loadExistingThreadSummary(chatId);
  const condenseResult = await condenseArcadiaContext({
    chatId,
    modelId,
    messagesToCondense,
    existingSummary,
  });

  if (condenseResult.error) {
    logger.error("runArcadiaContextCondensation", "Background condensation failed", {
      chatId,
      error: condenseResult.error,
      condensedMessageCount: messagesToCondense.length,
    });

    return;
  }

  logger.log("runArcadiaContextCondensation", "Background condensation complete", {
    chatId,
    modelId,
    condensedMessageCount: messagesToCondense.length,
    durationMs: Math.round(performance.now() - startedAt),
  });
}
