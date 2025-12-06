import { randomUUID } from "crypto";

import { openai, OpenAIProvider } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  smoothStream,
  stepCountIs,
} from "ai";

// import systemPrompt from "@/lib/system-prompt";
import { auth } from "@clerk/nextjs/server";

import { getContext, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createMemorySearchTool } from "@/lib/llm/llm-tool-kit";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemory } from "@/lib/memory/operations";
import { getSupabaseUserId } from "@/data/supabase/profiles";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

let systemPrompt = SYSTEM_PROMPT;

const model: Parameters<OpenAIProvider>[0] = "gpt-5";

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return new Response("User not found in supabase", { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

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
    maxOutputTokens: 3000, // Cap output for dev guardrails
    tools: {
      search_memories: createMemorySearchTool(sbUserId),
    },
    stopWhen: stepCountIs(2),
  });

  result.consumeStream();

  // logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onFinish: async ({ messages }) => {
      try {
        const startOnFinish = performance.now();
        /***
         * Save chat
         */
        const startSaveChat = performance.now();
        const saveResult = await saveChat({ chatId: id, messages });
        const endSaveChat = performance.now();

        if (saveResult.error) {
          logger.error(
            "POST",
            `Error saving chat: ${saveResult.error.message}`
          );

          return; // Don't continue if save fails
        }

        /***
         * Ensure chat has a title
         */
        const startEnsureChatHasTitle = performance.now();

        if (messages.length > 3 && messages.length < 5) {
          ensureChatHasTitle(id);
        }
        const endEnsureChatHasTitle = performance.now();

        /***
         * Update chat summary
         */
        const startUpdateChatSummary = performance.now();
        const updateChatSummaryPromise = updateChatSummary(id);
        const endUpdateChatSummary = performance.now();

        /***
         * Update memory
         */
        const startAddLatestMessagesToMemory = performance.now();
        const userMessage = message;
        const aiResponse = messages[messages.length - 1];
        const addLatestMessagesToMemoryPromise = addLatestMessagesToMemory(
          [userMessage, aiResponse],
          sbUserId
        );
        const endAddLatestMessagesToMemory = performance.now();

        /**
         * Await lingering promises
         */
        await Promise.all([
          updateChatSummaryPromise,
          addLatestMessagesToMemoryPromise,
        ]);

        const endOnFinish = performance.now();

        logger.log(
          "POST",
          `Time from stream complete to onFinish callback complete: ${endOnFinish - startOnFinish} milliseconds`
        );
        logger.log(
          "POST",
          `Time from stream complete to save chat: ${endSaveChat - startSaveChat} milliseconds`
        );
        logger.log(
          "POST",
          `Time from stream complete to ensure chat has title: ${endEnsureChatHasTitle - startEnsureChatHasTitle} milliseconds`
        );
        logger.log(
          "POST",
          `Time from stream complete to update chat summary: ${endUpdateChatSummary - startUpdateChatSummary} milliseconds`
        );
        logger.log(
          "POST",
          `Time from stream complete to add latest messages to memory: ${endAddLatestMessagesToMemory - startAddLatestMessagesToMemory} milliseconds`
        );
        logger.log(
          "POST",
          `Time from initial request recieved to onFinish callback complete: ${endOnFinish - startOnFinish} milliseconds`
        );
      } catch (err) {
        logger.error("POST", `Error in onFinish callback: ${err}`);
      }
    },
    generateMessageId: () => randomUUID(),
  });
}
