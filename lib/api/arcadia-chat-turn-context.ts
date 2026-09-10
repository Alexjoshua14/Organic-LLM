import type { UIMessage } from "ai";
import type { Logger } from "@/lib/logger";

import { TypeValidationError } from "ai";

import { mainChatSystemPromptWhenContextFailed } from "./chat-context-fallbacks";
import type { LoadMainChatTurnContextResult } from "./chat-turn-context";

import { getMessages } from "@/data/supabase/chat";
import {
  ARCADIA_MESSAGE_TOKEN_BUDGET,
  selectArcadiaContextMessages,
} from "@/lib/chat/arcadia-token-context";
import { getContext } from "@/lib/chat/chat-store";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";

export type LoadArcadiaChatTurnContextParams = {
  logger: Logger;
  chatId: string;
  message: UIMessage;
  memoryEnabled: boolean | undefined;
};

/**
 * Arcadia prototype: token-window message selection (50k). When condensation is needed,
 * the turn proceeds immediately; the route schedules background condensation via `after()`.
 */
export async function loadArcadiaChatTurnContext(
  params: LoadArcadiaChatTurnContextParams
): Promise<LoadMainChatTurnContextResult> {
  const { logger, chatId, message, memoryEnabled } = params;

  let validatedMessages: UIMessage[];
  let systemPromptForRequest = SYSTEM_PROMPT;
  let tokenBreakdown: Array<{ name: string; tokens: number }> | undefined;
  let packedMessageCount: number | undefined;
  let totalThreadMessages: number | undefined;
  let memoriesInjected: number | undefined;
  let scheduleBackgroundCondensation = false;

  try {
    const allMessagesResult = await getMessages(chatId);

    if (allMessagesResult.error || allMessagesResult.data === null) {
      logger.error("POST", "Error loading Arcadia thread messages", {
        error: allMessagesResult.error,
      });

      validatedMessages = [message];
      systemPromptForRequest = mainChatSystemPromptWhenContextFailed();

      return {
        validatedMessages,
        systemPromptForRequest,
      };
    }

    const allMessages = allMessagesResult.data;
    const selection = selectArcadiaContextMessages(allMessages);
    scheduleBackgroundCondensation =
      selection.needsCondensation && selection.messagesToCondense.length > 0;

    if (scheduleBackgroundCondensation) {
      logger.log("POST", "Arcadia condensation scheduled in background", {
        condensedCandidates: selection.messagesToCondense.length,
        keptMessages: selection.contextMessages.length,
      });
    }

    const chatContextResult = await getContext({
      chatId,
      message,
      memoryEnabled,
      experience: "arcadia",
      messagesOverride: selection.contextMessages,
      totalThreadMessagesOverride: selection.totalThreadMessages,
      contextWindowLabel: `${ARCADIA_MESSAGE_TOKEN_BUDGET.toLocaleString()}-token window`,
    });

    if (chatContextResult.error) {
      logger.error("POST", "Error getting Arcadia chat context", {
        error: chatContextResult.error,
      });
      validatedMessages = [message];
      systemPromptForRequest = mainChatSystemPromptWhenContextFailed();
      logger.debug("context", "Arcadia context failed; using only incoming message");
    } else {
      validatedMessages = [...(chatContextResult.data?.messages ?? []), message];
      systemPromptForRequest = chatContextResult.data?.context ?? systemPromptForRequest;
      tokenBreakdown = chatContextResult.data?.tokenBreakdown;
      packedMessageCount = chatContextResult.data?.packedMessageCount;
      totalThreadMessages = chatContextResult.data?.totalThreadMessages;
      memoriesInjected = chatContextResult.data?.memories?.length;

      logger.debug("context", "Arcadia token context gathered", {
        historyMessageCount: chatContextResult.data?.messages?.length ?? 0,
        contextMessageTokens: selection.contextMessageTokens,
        pinnedCount: selection.pinnedCount,
        recentCount: selection.recentCount,
        condensedCandidates: selection.messagesToCondense.length,
        contextLength: chatContextResult.data?.context?.length ?? 0,
        scheduleBackgroundCondensation,
      });
    }
  } catch (err) {
    if (err instanceof TypeValidationError) {
      logger.error("POST", "Database messages validation failed");
      validatedMessages = [message];
      systemPromptForRequest = mainChatSystemPromptWhenContextFailed();
    } else {
      throw err;
    }
  }

  return {
    validatedMessages,
    systemPromptForRequest,
    tokenBreakdown,
    packedMessageCount,
    totalThreadMessages,
    memoriesInjected,
    scheduleBackgroundCondensation,
  };
}
