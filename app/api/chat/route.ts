import { randomUUID } from "crypto";

import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  smoothStream,
  consumeStream,
  stepCountIs,
} from "ai";
// import systemPrompt from "@/lib/system-prompt";
import { auth } from "@clerk/nextjs/server";

import { deleteChatMessage, getContext, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createMemorySearchTool } from "@/lib/llm/llm-tool-kit";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemory } from "@/lib/memory/operations";
import { z } from "zod";

import {
  ChatRequestSchema,
  ChatModel,
  type ChatModelType,
} from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

// Default model configuration
const DEFAULT_CHAT_MODEL: ChatModelType = "gpt-5";
const CHAT_MODEL = {
  name: DEFAULT_CHAT_MODEL,
  maxOutputTokens: 3000,
};

/**
 * Gets a validated chat model, falling back to default if invalid
 * @param model - Optional model string to validate
 * @returns Validated chat model
 */
function getChatModel(model?: string): ChatModelType {
  if (!model) {
    logger.log(
      "getChatModel",
      `No model provided, using default: ${DEFAULT_CHAT_MODEL}`
    );
    return DEFAULT_CHAT_MODEL;
  }

  const parseResult = ChatModel.safeParse(model);
  if (!parseResult.success) {
    logger.error(
      "getChatModel",
      `Invalid model "${model}", falling back to default: ${DEFAULT_CHAT_MODEL}`
    );
    return DEFAULT_CHAT_MODEL;
  }

  logger.log("getChatModel", `Validated model: ${parseResult.data}`);
  return parseResult.data;
}
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

  logger.log("POST", `Received request body: ${JSON.stringify(body)}`);

  const parseResult = ChatRequestSchema.safeParse(body);
  // Grab the selectedModel from either the parsed request body or default to DEFAULT_CHAT_MODEL
  const requestedModel = body?.model;
  const selectedModel = requestedModel
    ? getChatModel(requestedModel)
    : DEFAULT_CHAT_MODEL;

  const memoryEnabled = process.env.MEMORY_ENABLED === "TRUE";

  logger.log(
    "POST",
    `Model selection - Requested: ${requestedModel ?? "none"}, Using: ${selectedModel}`
  );

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

  // Save the user message
  try {
    // TODO: Make this async and nonblocking
    await saveChat({
      chatId: id,
      messages: [message], // Just the user's message
    });
    logger.log("POST", "User message saved optimistically");
  } catch (err) {
    logger.error("POST", `Failed to save user message optimistically: ${err}`);
    // Continue anyway - onFinish will try to save again
  }

  let validatedMessages: UIMessage[];
  let systemPromptForRequest = SYSTEM_PROMPT;

  try {
    const chatContextResult = await getContext({
      chatId: id,
      limit: 10,
      message,
      memoryEnabled,
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
    Model: ${selectedModel}
    `
  );

  logger.log("POST", `Calling streamText with model: ${selectedModel}`);

  const streamStartTime = performance.now();

  const result = streamText({
    model: openai(selectedModel),
    messages: convertToModelMessages(validatedMessages),
    system: systemPromptForRequest,
    abortSignal: req.signal,
    experimental_transform: smoothStream({
      delayInMs: 5, // optional: defaults to 10ms
      chunking: "word", // optional: defaults to 'word'
    }),
    maxOutputTokens: CHAT_MODEL.maxOutputTokens, // Cap output for dev guardrails
    onError({ error }) {
      logger.error("POST", `Stream error: ${error}`);
    },
    tools: {
      search_memories: createMemorySearchTool(sbUserId),
    },
    stopWhen: stepCountIs(2),
  });

  // Start consuming stream early to surface errors before returning the response
  // result.consumeStream();

  // logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    consumeSseStream: consumeStream,
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
    onFinish: async ({ messages, isAborted }) => {
      // Handle abort
      if (isAborted) {
        // Remove optimsitcally saved user message
        logger.log(
          "POST",
          `Abort detected: removing optimistically saved user message`
        );
        deleteChatMessage(message.id);
      } else {
        const onFinishStart = performance.now();
        const streamEndTime = performance.now();
        const modelGenerationTime = streamEndTime - streamStartTime;

        const metrics: Record<string, number> = {
          modelGenerationTimeMs: modelGenerationTime,
        };

        logger.log(
          "POST",
          `Model (${selectedModel}) generated response in ${modelGenerationTime.toFixed(2)}ms (${(modelGenerationTime / 1000).toFixed(2)}s)`
        );

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

          const promises: Promise<any>[] = [];

          const updateChatSummaryPromise = measureAsync(() =>
            updateChatSummary(id)
          );
          promises.push(updateChatSummaryPromise);
          if (memoryEnabled) {
            const addLatestMessagesToMemoryPromise = measureAsync(() =>
              addLatestMessagesToMemory([userMessage, aiResponse], sbUserId)
            );
            promises.push(addLatestMessagesToMemoryPromise);
          }

          const [
            { result: updateSummaryResult, durationMs: updateChatSummaryMs },
            { durationMs: addMemoryMs },
          ] = await Promise.all(promises);

          metrics.updateChatSummaryMs = updateChatSummaryMs;
          if (memoryEnabled) {
            metrics.addLatestMessagesToMemoryMs = addMemoryMs;
          }

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
      }
    },
    generateMessageId: () => randomUUID(),
  });
}
