import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  validateUIMessages,
  TypeValidationError,
  createIdGenerator,
} from "ai";

// import systemPrompt from "@/lib/system-prompt";
import {
  getMessagesForChatPrompt,
  loadChat,
  saveChat,
} from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

let systemPrompt = SYSTEM_PROMPT;

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  logger.log("POST", `Recieved Message: ${JSON.stringify(message)}`);

  let validatedMessages: UIMessage[];

  try {
    const chatContextResult = await getMessagesForChatPrompt(id);

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
      systemPrompt = chatContextResult.data?.prompt ?? systemPrompt;
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

  logger.log(
    "POST",
    `
    System Prompt: ${systemPrompt.length} characters
    \n\n--------------------------------\n\n
    ${validatedMessages.length} messages being sent to LLM
    `
  );

  const result = streamText({
    model: openai("gpt-5-mini"),
    messages: convertToModelMessages(validatedMessages),
    system: systemPrompt,
  });

  // logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onFinish: async ({ messages }) => {
      await saveChat({ chatId: id, messages });
      if (messages.length > 3 && messages.length < 5) {
        ensureChatHasTitle(id);
      }
      await updateChatSummary(id);
    },
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
  });
}
