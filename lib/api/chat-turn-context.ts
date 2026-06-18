import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { Logger } from "@/lib/logger";

import { TypeValidationError } from "ai";

import { mainChatSystemPromptWhenContextFailed } from "./chat-context-fallbacks";

import {
  isIntrospectionExperience,
} from "@/lib/chat/chat-experience";
import { getContext } from "@/lib/chat/chat-store";
import { INTROSPECTION_CONTEXT_MESSAGE_LIMIT } from "@/lib/personas/introspection";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";

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

function getContextMessageLimit(experience: ChatExperience | undefined): number {
  if (isStrataExperience(experience)) return 30;
  if (isIntrospectionExperience(experience)) return INTROSPECTION_CONTEXT_MESSAGE_LIMIT;

  return 10;
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
      limit: getContextMessageLimit(experience),
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
