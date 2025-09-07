import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  createIdGenerator,
} from "ai";

// import systemPrompt from "@/lib/system-prompt";
import { getMessagesForChatPrompt, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  logger.log("POST", `Recieved Message: ${JSON.stringify(message)}`);

  let validatedMessages: UIMessage[];
  let systemPrompt = SYSTEM_PROMPT;

  try {
    const chatContextResult = await getMessagesForChatPrompt(
      id,
      10,
      "prometheus" as const,
    );

    if (chatContextResult.error) {
      logger.error(
        "POST",
        `Error getting chat context: ${chatContextResult.error}`,
      );
      validatedMessages = [message];
    } else {
      validatedMessages = [
        ...(chatContextResult.data?.messages ?? []),
        message,
      ];
      systemPrompt = chatContextResult.data?.prompt ?? systemPrompt;
    }
  } catch (err) {
    if (err instanceof TypeValidationError) {
      logger.error(
        "POST",
        `Database messages validation failed: ${err.message}`,
      );
      validatedMessages = [];
    } else {
      throw err;
    }
  }

  logger.log(
    `POST`,
    `Reaching out to model now with ${validatedMessages.length} messages`,
  );

  const result = streamText({
    model: openai("gpt-5-mini"),
    system: systemPrompt,
    messages: convertToModelMessages(validatedMessages),
  });

  logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onFinish: ({ messages }) => {
      saveChat({ chatId: id, messages });
      if (messages.length > 3 && messages.length < 5) {
        ensureChatHasTitle(id);
      }
    },
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
  });
}
