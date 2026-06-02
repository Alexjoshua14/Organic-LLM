import type { UIMessage } from "ai";
import { TypeValidationError } from "ai";

import type { ChatExperience } from "@/lib/chat/chat-experience";
import { getContext } from "@/lib/chat/chat-store";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import type { Logger } from "@/lib/logger";

import { mainChatSystemPromptWhenContextFailed } from "./chat-context-fallbacks";

export type LoadMainChatTurnContextParams = {
  logger: Logger;
  chatId: string;
  message: UIMessage;
  memoryEnabled: boolean | undefined;
  experience: ChatExperience | undefined;
};

export type LoadMainChatTurnContextResult = {
  validatedMessages: UIMessage[];
  systemPromptForRequest: string;
};

function isStrataExperience(experience: ChatExperience | undefined): boolean {
  return experience === "strata_hub" || experience === "strata_page";
}

/**
 * Mirrors getContext + fallbacks in the main chat stream (same limits and logging).
 */
export async function loadMainChatTurnContext(
  params: LoadMainChatTurnContextParams
): Promise<LoadMainChatTurnContextResult> {
  const { logger, chatId, message, memoryEnabled, experience } = params;

  let validatedMessages: UIMessage[];
  let systemPromptForRequest = SYSTEM_PROMPT;

  try {
    const chatContextResult = await getContext({
      chatId,
      limit: isStrataExperience(experience) ? 30 : 10,
      message,
      memoryEnabled,
      persistedSchemasEnabled: isStrataExperience(experience),
      experience,
    });

    if (chatContextResult.error) {
      logger.error("POST", "Error getting chat context", {
        error: chatContextResult.error,
      });
      validatedMessages = [message];
      systemPromptForRequest = mainChatSystemPromptWhenContextFailed();
      logger.debug("context", "Context failed; using only incoming message");
    } else {
      validatedMessages = [...(chatContextResult.data?.messages ?? []), message];
      systemPromptForRequest = chatContextResult.data?.context ?? systemPromptForRequest;
      logger.debug("context", "Context gathered", {
        historyMessageCount: chatContextResult.data?.messages?.length ?? 0,
        contextLength: chatContextResult.data?.context?.length ?? 0,
        memoriesCount: chatContextResult.data?.memories?.length ?? 0,
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

  return { validatedMessages, systemPromptForRequest };
}
