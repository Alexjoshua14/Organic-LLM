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
  type Tool,
  createUIMessageStream,
} from "ai";
// import systemPrompt from "@/lib/system-prompt";
import { auth } from "@clerk/nextjs/server";

import { deleteChatMessage, getContext, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createMemorySearchTool } from "@/lib/llm/llm-tool-kit";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemory } from "@/lib/memory/operations";

import {
  ChatRequestSchema,
  DEFAULT_CHAT_MODEL,
  ChatModelSchema,
  type ChatModel,
} from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { CHAT_MODEL, getChatModel, measureAsync } from "@/lib/llm/helpers";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const body = await req.json();

  logger.log("POST", `Received request body: ${JSON.stringify(body)}`);

  const parseResult = ChatRequestSchema.safeParse(body);
  // Grab the selectedModel from either the parsed request body or default to DEFAULT_CHAT_MODEL
  const requestedModel = parseResult.data?.model;
  const selectedModel = requestedModel
    ? getChatModel(requestedModel)
    : DEFAULT_CHAT_MODEL;

  const memoryEnabled = parseResult.data?.memory;

  logger.log(
    "POST",
    `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
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

  // const tools = compileTools({ useSearch, useMemory});

  logger.log("POST", `Calling streamText with model: ${selectedModel}`);

  const streamStartTime = performance.now();

  const result = streamText({
    model: openai(selectedModel.id),
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
    onFinish: async ({ messages, isAborted, finishReason }) => {
      switch (finishReason) {
        case "error":
          logger.error("POST", "LLM encountered an error.");
          break;
        case "length":
          logger.warn(
            "POST",
            "LLM response stopped due to reaching max limit."
          );
          break;
      }

      // Handle abort
      if (isAborted) {
        // Remove optimistically saved user message
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

          // Ensure chat title for a sensible range (e.g. after 4–8 messages)
          if (messages.length >= 4 && messages.length <= 8) {
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

          const updateSummaryResult = await measureAsync(() =>
            updateChatSummary(id)
          );
          metrics.updateChatSummaryMs = updateSummaryResult.durationMs;

          let addMemoryMs: number | undefined;
          if (memoryEnabled) {
            const addMemoryResult = await measureAsync(() =>
              addLatestMessagesToMemory(
                [userMessage, aiResponse],
                sbUserId
              ).catch((err) => {
                logger.error(
                  "POST",
                  `Error adding latest messages to memory: ${err}`
                );
              })
            );
            addMemoryMs = addMemoryResult.durationMs;
            metrics.addLatestMessagesToMemoryMs = addMemoryMs;
          }

          if (updateSummaryResult.result?.error) {
            logger.error(
              "POST",
              `Error updating chat summary: ${updateSummaryResult.result.error}`
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

// TODO: Make this work
const compileTools = ({
  useSearch,
  useMemory,
  sbUserId,
}: {
  useSearch: boolean;
  useMemory: boolean;
  sbUserId: string;
}): Tool[] => {
  // Compile and return an array of tools as expected by streamText({ tools })
  const tools: Tool[] = []; // TODO: Fill this in based on req or other context

  if (useMemory) {
    // tools.push({ search_memories: createMemorySearchTool(sbUserId) });
  }
  return tools;
};
