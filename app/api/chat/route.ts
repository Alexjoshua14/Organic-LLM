import { openai, OpenAIProvider } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  createIdGenerator,
  smoothStream,
} from "ai";

// import systemPrompt from "@/lib/system-prompt";
import {
  getContext,
  getMessagesForChatPrompt,
  saveChat,
} from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemory } from "@/lib/memory/operations";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

let systemPrompt = SYSTEM_PROMPT;

const model: Parameters<OpenAIProvider>[0] = "gpt-5";

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  logger.log("POST", `Recieved Message: ${JSON.stringify(message)}`);

  let validatedMessages: UIMessage[];

  try {
    const chatContextResult = await getContext({
      chatId: id,
      limit: 10,
      message,
    });

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
      systemPrompt = chatContextResult.data?.context ?? systemPrompt;
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
    model: openai(model),
    messages: convertToModelMessages(validatedMessages),
    system: systemPrompt,
    experimental_transform: smoothStream({
      delayInMs: 20, // optional: defaults to 10ms
      chunking: "word", // optional: defaults to 'word'
    }),
    maxOutputTokens: 3000,
  });

  // logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onFinish: async ({ messages }) => {
      /***
       * Save chat
       */
      await saveChat({ chatId: id, messages });
      if (messages.length > 3 && messages.length < 5) {
        ensureChatHasTitle(id);
      }

      /***
       * Update chat summary
       */
      await updateChatSummary(id);

      /***
       * Update memory
       */
      const userMessage = message;
      const aiResponse = messages[messages.length - 1];
      await addLatestMessagesToMemory([userMessage, aiResponse], "test-user");
    },
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
  });
}
