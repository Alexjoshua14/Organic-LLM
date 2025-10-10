import { UIMessage, TypeValidationError } from "ai";
import { id } from "zod/v4/locales";
import { getContextAndMessagesChatPrompt } from "../chat/chat-store";
import { estimateTokenCount } from "./chat-helpers";
import { SYSTEM_PROMPT } from "../system-prompt/prompt-v0";
import { createLogger } from "../logger";
import { Result } from "@/types";

const logger = createLogger("lib/llm/context.ts");

let systemPrompt = SYSTEM_PROMPT;

interface getContextProps {
  chatId: string;
  message: UIMessage;
  persona?: "prometheus" | "spark";
}

export const getContext = async ({
  chatId,
  message,
  persona,
}: getContextProps): Promise<
  Result<{ prompt: string; messages: UIMessage[] }, string>
> => {
  let validatedMessages: UIMessage[];

  try {
    const chatContextResult = await getContextAndMessagesChatPrompt(
      chatId,
      10,
      persona
    );

    if (chatContextResult.error) {
      logger.error(
        "POST",
        `Error getting chat context: ${chatContextResult.error}`
      );
      validatedMessages = [message];
    } else {
      validatedMessages = [
        ...(chatContextResult.data?.messages ?? []),
        message,
      ];
      if (chatContextResult.data?.prompt) {
        systemPrompt = chatContextResult.data?.prompt;
      }
    }

    // const previousMessages = await loadChat(id).then(
    //   (res) => res.data?.messages ?? [],
    // );

    // validatedMessages = await validateUIMessages({
    //   messages: [...previousMessages, message],
    //   tools,
    // });
  } catch (err) {
    if (err instanceof TypeValidationError) {
      logger.error(
        "POST",
        `Database messages validation failed: ${err.message}`
      );
      validatedMessages = [message];
    } else {
      throw err;
    }
  }

  const systemPromptTokens = await estimateTokenCount(systemPrompt);

  logger.log(
    "POST",
    `
    System Prompt: ${systemPrompt.length} characters\n`,
    `System Prompt ${systemPromptTokens} tokens\n`,
    //`System Prompt: ${systemPrompt}\n`,
    `\n\n--------------------------------\n\n`,
    `${validatedMessages.length} messages being sent to LLM`
  );

  return {
    data: {
      prompt: systemPrompt,
      messages: validatedMessages,
    },
    error: null,
  };
};
