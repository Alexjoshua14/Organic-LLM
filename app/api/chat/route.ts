import { randomUUID } from "crypto";

import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  smoothStream,
} from "ai";
// import systemPrompt from "@/lib/system-prompt";
import { auth } from "@clerk/nextjs/server";

import { getContext, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemory } from "@/lib/memory/operations";
import { ChatRequestSchema } from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

const CHAT_MODEL = {
  name: "gpt-5" as const,
  maxOutputTokens: 3000,
};

type MeasureResult<T> = { result: T; durationMs: number };

async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<MeasureResult<T>> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;

  return { result, durationMs };
}

export async function POST(req: Request) {
  const body = await req.json();
  const parseResult = ChatRequestSchema.safeParse(body);

  if (!parseResult.success) {
    logger.error(
      "POST",
      `Invalid request body: ${parseResult.error.flatten().formErrors.join(", ")}`
    );

    return new Response("Invalid request body", { status: 400 });
  }

  const { message: incomingMessage, id } = parseResult.data;
  const message = incomingMessage as UIMessage;

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
  let systemPromptForRequest = SYSTEM_PROMPT;

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
      systemPromptForRequest =
        chatContextResult.data?.context ?? systemPromptForRequest;
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
    System Prompt: ${systemPromptForRequest.length} characters
    \n\n--------------------------------\n\n
    ${validatedMessages.length} messages being sent to LLM
    `
  );

  const result = streamText({
    model: openai(CHAT_MODEL.name),
    messages: convertToModelMessages(validatedMessages),
    system: systemPromptForRequest,
    experimental_transform: smoothStream({
      delayInMs: 20, // optional: defaults to 10ms
      chunking: "word", // optional: defaults to 'word'
    }),
    maxOutputTokens: CHAT_MODEL.maxOutputTokens, // Cap output for dev guardrails
    onError({ error }) {
      logger.error("POST", `Stream error: ${error}`);
    },
  });

  // Start consuming stream early to surface errors before returning the response
  result.consumeStream();

  // logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onError: (error) => {
      logger.error("POST", `UI stream error: ${error}`);
      if (error instanceof Error) {
        return error.message;
      }
      if (typeof error === "string") {
        return error;
      }

      return "An unexpected error occurred";
    },
    onFinish: async ({ messages }) => {
      const onFinishStart = performance.now();
      const metrics: Record<string, number> = {};

      try {
        const { result: saveResult, durationMs: saveChatMs } =
          await measureAsync(() => saveChat({ chatId: id, messages }));
        metrics.saveChatMs = saveChatMs;

        if (saveResult.error) {
          logger.error(
            "POST",
            `Error saving chat: ${saveResult.error.message}`
          );

          return; // Don't continue if save fails
        }

        let ensureChatHasTitleMs: number | undefined;

        if (messages.length > 3 && messages.length < 5) {
          const { result: titleResult, durationMs } = await measureAsync(() =>
            ensureChatHasTitle(id)
          );
          ensureChatHasTitleMs = durationMs;

          if (titleResult.error) {
            logger.error(
              "POST",
              `Error ensuring chat has title: ${titleResult.error.message}`
            );
          }
        }

        const userMessage = message;
        const aiResponse = messages[messages.length - 1];

        if (!aiResponse) {
          logger.error(
            "POST",
            "No AI response found in messages; skipping post-processing"
          );
          return;
        }

        const updateChatSummaryPromise = measureAsync(() =>
          updateChatSummary(id)
        );
        const addLatestMessagesToMemoryPromise = measureAsync(() =>
          addLatestMessagesToMemory([userMessage, aiResponse], sbUserId)
        );

        const [
          { result: updateSummaryResult, durationMs: updateChatSummaryMs },
          { durationMs: addMemoryMs },
        ] = await Promise.all([
          updateChatSummaryPromise,
          addLatestMessagesToMemoryPromise,
        ]);

        metrics.updateChatSummaryMs = updateChatSummaryMs;
        metrics.addLatestMessagesToMemoryMs = addMemoryMs;

        if (updateSummaryResult?.error) {
          logger.error(
            "POST",
            `Error updating chat summary: ${updateSummaryResult.error}`
          );
        }

        metrics.onFinishTotalMs = performance.now() - onFinishStart;
        if (ensureChatHasTitleMs !== undefined) {
          metrics.ensureChatHasTitleMs = ensureChatHasTitleMs;
        }

        logger.log("POST", `onFinish metrics: ${JSON.stringify(metrics)}`);
      } catch (err) {
        logger.error("POST", `Error in onFinish callback: ${err}`);
      }
    },
    generateMessageId: () => randomUUID(),
  });
}
