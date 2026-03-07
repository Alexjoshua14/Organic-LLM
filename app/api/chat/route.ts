import { randomUUID } from "crypto";

import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  smoothStream,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  ToolSet,
  generateId,
} from "ai";
// import systemPrompt from "@/lib/system-prompt";
import { auth } from "@clerk/nextjs/server";
import { GatewayProviderOptions } from "@ai-sdk/gateway";

import { deleteChatMessage, getContext, saveChat } from "@/lib/chat/chat-store";
import { getThreadHasTitle } from "@/data/supabase/chat";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import {
  createGetFullChatHistoryTool,
  createGetMessagesFromDateTool,
  createGetMoreMessagesTool,
  createMemorySearchTool,
  createWebSearchTool,
  type WebSearchStreamWriter,
} from "@/lib/llm/llm-tool-kit";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemory } from "@/lib/memory/operations";

import { ChatRequestSchema, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { CHAT_MODEL, getChatModel, measureAsync } from "@/lib/llm/helpers";
import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { ChatUIMessage, ChatAIActionEnum } from "@/types/ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const MAX_TOOL_STEPS = 10;

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
    `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`,
  );

  if (!parseResult.success) {
    logger.error(
      "POST",
      `Invalid request body: ${parseResult.error.flatten().formErrors.join(", ")}`,
    );

    return new Response("Invalid request body", { status: 400 });
  }

  const { message: incomingMessage, id, zeroDataRetention } = parseResult.data;
  const message = incomingMessage as UIMessage;

  // Zero Data Retention Policy is in regards to external LLMs, not Organic LLM at this time
  // If enabled, we only use LLMs that have ZDR compatibility
  const isZeroDataRetention = zeroDataRetention === true;

  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return new Response("User not found in supabase", { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

  // Start fetching thread title status early; result is only needed in onFinish (non-blocking). Uses cache / client hint when possible.
  const threadHasTitlePromise = getThreadHasTitle(id, {
    knownHasTitle: parseResult.data.threadHasTitle === true,
  });

  /**
   * Generate stable message ID for this entire response
   */
  const assistantMessageId = randomUUID();

  logger.log("POST", `Recieved Message: ${JSON.stringify(message)}`);

  // Save the user message

  saveChat({ chatId: id, messages: [message] })
    .then(() => {
      logger.log("POST", "User message saved optimistically");
    })
    .catch((err) => {
      logger.error("POST", `Failed to save user message: ${err}`);
    });

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-aiAction",
        data: {
          action: ChatAIActionEnum.Processing,
          message: "Gathering context",
        },
        transient: true,
      });

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
            `Error getting chat context: ${chatContextResult.error}`,
          );
          validatedMessages = [message];
          logger.debug(
            "context",
            "Context failed; using only incoming message",
          );
        } else {
          validatedMessages = [
            ...(chatContextResult.data?.messages ?? []),
            message,
          ];
          systemPromptForRequest =
            chatContextResult.data?.context ?? systemPromptForRequest;
          logger.debug("context", "Context gathered", {
            historyMessageCount: chatContextResult.data?.messages?.length ?? 0,
            contextLength: chatContextResult.data?.context?.length ?? 0,
            contextPreview:
              chatContextResult.data?.context?.slice(0, 200) +
              (chatContextResult.data?.context &&
              chatContextResult.data.context.length > 200
                ? "…"
                : ""),
            memoriesCount: chatContextResult.data?.memories?.length ?? 0,
          });
        }
      } catch (err) {
        if (err instanceof TypeValidationError) {
          logger.error(
            "POST",
            `Database messages validation failed: ${err.message}`,
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
    `,
      );

      logger.debug("messages", "Messages being sent to LLM", {
        count: validatedMessages.length,
        summary: validatedMessages.map((m) => {
          const msg = m as {
            role?: string;
            id?: string;
            content?: string | unknown[];
          };
          const content = msg.content;
          return {
            role: msg.role ?? "unknown",
            id: msg.id,
            contentLength:
              typeof content === "string"
                ? content.length
                : Array.isArray(content)
                  ? content.length
                  : 0,
          };
        }),
      });

      writer.write({
        type: "data-notification",
        data: { message: `Using ${selectedModel.name}`, level: "info" },
        transient: true,
      });

      logger.log("POST", `Calling streamText with model: ${selectedModel}`);

      const streamStartTime = performance.now();
      const messages = convertToModelMessages(validatedMessages);
      const initialMessageCount = validatedMessages.length;
      const { tools, toolInstructions } = await compileTools({
        useSearch: parseResult.data.webSearch ?? false,
        useMemory: parseResult.data.memory ?? false,
        useGetMoreMessages: true,
        chatId: id,
        initialMessageCount,
        sbUserId,
        writer,
      });

      const toolNames = Object.keys(tools);
      logger.debug("tools", "Compiled tools", {
        toolNames,
        toolCount: toolNames.length,
        toolInstructionsLength: toolInstructions.length,
        toolInstructionsPreview:
          toolInstructions.slice(0, 300) +
          (toolInstructions.length > 300 ? "…" : ""),
      });

      const hasTools = toolNames.length > 0;
      // One round of tool use + one round of response; avoids redundant multi-step searches
      const maxSteps = hasTools ? MAX_TOOL_STEPS : 2;
      if (hasTools) {
        systemPromptForRequest += `\n\nTool Instructions:\n${toolInstructions}`;
      }

      if (parseResult.data.speechFriendly) {
        systemPromptForRequest += `\n\nOutput format (speech-friendly mode): Format your response for both clear on-screen reading and later use as a script for audio. Use clear structure, headings, and visually appealing formatting. A separate pipeline will convert your text into a speech-friendly script and handle text-to-speech, so focus on clarity, structure, and readability—not on pronouncing abbreviations or avoiding punctuation.`;
      }

      writer.write({
        type: "data-aiAction",
        data: { action: ChatAIActionEnum.Processing, message: "Thinking..." },
        transient: true,
      });

      logger.debug("streamText", "Calling streamText", {
        model: selectedModel.id,
        modelName: selectedModel.name,
        messageCount: messages.length,
        systemPromptLength: systemPromptForRequest.length,
        maxSteps,
        toolChoice: hasTools ? "auto" : "none",
      });

      const result = streamText({
        model: selectedModel.id,
        messages,
        system: systemPromptForRequest,
        experimental_transform: smoothStream({
          delayInMs: 20, // optional: defaults to 10ms
          chunking: /(```[\s\S]*?```|^#{1,6}\s.*$|.*?(?:\n|$))/gm, // optional: defaults to 'word'
        }),
        maxOutputTokens: CHAT_MODEL.maxOutputTokens, // Cap output for dev guardrails
        onError({ error }) {
          logger.error("POST", `Stream error: ${error}`);
        },
        onFinish() {
          writer.write({
            type: "data-notification",
            data: { message: "Request completed", level: "info" },
            transient: true,
          });
        },
        onChunk: (chunk) => {
          logger.log("POST", `Chunk: ${chunk.chunk.type}`);
          if (chunk.chunk.type === "reasoning-delta") {
            writer.write({
              type: "data-aiAction",
              data: { action: ChatAIActionEnum.Reasoning },
              transient: true,
            });
          } else if (chunk.chunk.type === "tool-call") {
            writer.write({
              type: "data-aiAction",
              data: {
                action: ChatAIActionEnum.Tool,
                message: `Using tool: ${chunk.chunk.toolName}`,
              },
              transient: true,
            });
          }
        },
        providerOptions: {
          openai: {
            include: ["reasoning.encrypted_content"],
          } satisfies OpenAIResponsesProviderOptions,
          gateway: {
            zeroDataRetention: isZeroDataRetention,
          } satisfies GatewayProviderOptions,
        },
        tools,
        toolChoice: hasTools ? "auto" : "none",
        stopWhen: stepCountIs(maxSteps),
      });

      writer.merge(
        result.toUIMessageStream({
          generateMessageId: () => assistantMessageId,
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
            logger.log("POST", `FINISH REASON: ${finishReason}`);
            if (!finishReason && !isAborted) {
              logger.error(
                "POST",
                "No finish reason provided, assuming failure",
              );
              return;
            }
            switch (finishReason) {
              case "error":
                logger.error("POST", "LLM encountered an error.");
                break;
              case "length":
                logger.warn(
                  "POST",
                  "LLM response stopped due to reaching max limit.",
                );
                break;
            }

            // Handle abort
            if (isAborted) {
              // Remove optimistically saved user message
              logger.log("POST", `Abort detected`);

              /** The following commented out section would full abort, dropping current generation */
              // logger.log("POST", "Removing optimistically saved user message");
              // deleteChatMessage(message.id);
              // return;
            }

            const onFinishStart = performance.now();
            const streamEndTime = performance.now();
            const modelGenerationTime = streamEndTime - streamStartTime;

            const metrics: Record<string, number> = {
              modelGenerationTimeMs: modelGenerationTime,
            };

            logger.log(
              "POST",
              `Model (${selectedModel.id}) generated response in ${modelGenerationTime.toFixed(2)}ms (${(modelGenerationTime / 1000).toFixed(2)}s)`,
            );

            try {
              // TODO: Consider moving activeStreamId clearing to after successful save
              const { result: saveResult, durationMs: saveChatMs } =
                await measureAsync(() =>
                  saveChat({ chatId: id, messages, activeStreamId: null }),
                );
              metrics.saveChatMs = saveChatMs;

              if (saveResult.error) {
                logger.error(
                  "POST",
                  `Error saving chat: ${saveResult.error.message}`,
                );

                return; // Don't continue if save fails
              }

              // Fire-and-forget post-processing (don't block `onFinish`)
              void (async () => {
                let ensureChatHasTitleMs: number | undefined;

                // Use title status fetched earlier (or from request); by now the promise has had time to resolve
                const threadHasTitleResult = await threadHasTitlePromise;
                const threadAlreadyHasTitle =
                  parseResult.data.threadHasTitle === true ||
                  threadHasTitleResult.data === true;

                // Ensure chat has an LLM-generated title only when we have enough messages and don't already have one
                if (!threadAlreadyHasTitle && messages.length >= 4) {
                  const { result: titleResult, durationMs } =
                    await measureAsync(() => ensureChatHasTitle(id));
                  ensureChatHasTitleMs = durationMs;

                  if (titleResult.error) {
                    logger.error(
                      "POST",
                      `Error ensuring chat has title: ${titleResult.error.message}`,
                    );
                  }
                } else {
                  logger.log(
                    "POST",
                    "Chat already has title; skipping title generation",
                  );
                }

                const userMessage = message;
                const aiResponse = messages[messages.length - 1];

                if (!aiResponse) {
                  logger.error(
                    "POST",
                    "No AI response found in messages; skipping post-processing",
                  );
                  return;
                }

                const updateSummaryResult = await measureAsync(() =>
                  updateChatSummary(id),
                );
                metrics.updateChatSummaryMs = updateSummaryResult.durationMs;

                if (memoryEnabled) {
                  const addMemoryResult = await measureAsync(() =>
                    addLatestMessagesToMemory(
                      [userMessage, aiResponse],
                      sbUserId,
                      id,
                    ).catch((err) => {
                      logger.error(
                        "POST",
                        `Error adding latest messages to memory: ${err}`,
                      );
                    }),
                  );
                  metrics.addLatestMessagesToMemoryMs =
                    addMemoryResult.durationMs;
                }

                if (updateSummaryResult.result?.error) {
                  logger.error(
                    "POST",
                    `Error updating chat summary: ${updateSummaryResult.result.error}`,
                  );
                }

                metrics.onFinishTotalMs = performance.now() - onFinishStart;
                if (ensureChatHasTitleMs !== undefined) {
                  metrics.ensureChatHasTitleMs = ensureChatHasTitleMs;
                }

                logger.log(
                  "POST",
                  `onFinish metrics: ${JSON.stringify(metrics)}`,
                );
              })().catch((err) => {
                logger.error("POST", `Error in post-processing task: ${err}`);
              });
            } catch (err) {
              logger.error("POST", `Error in onFinish callback: ${err}`);
            }
          },
        }),
      );
    },
  });

  return createUIMessageStreamResponse({
    stream,
    async consumeSseStream({ stream }) {
      const streamId = generateId();
      const streamContext = createResumableStreamContext({ waitUntil: after });

      await streamContext.createNewResumableStream(streamId, () => stream);

      await saveChat({ chatId: id, activeStreamId: streamId });
    },
  });
}

const compileTools = async ({
  useSearch,
  useMemory,
  useGetMoreMessages,
  chatId,
  initialMessageCount,
  sbUserId,
  writer,
}: {
  useSearch: boolean;
  useMemory: boolean;
  useGetMoreMessages?: boolean;
  chatId?: string;
  initialMessageCount?: number;
  sbUserId: string;
  writer?: WebSearchStreamWriter;
}): Promise<{ tools: ToolSet; toolInstructions: string }> => {
  // Compile and return an array of tools as expected by streamText({ tools })
  const tools: ToolSet = {};
  let toolInstructions = "";

  if (useMemory) {
    const memorySearchTool = createMemorySearchTool(sbUserId);
    tools["search_memories"] = memorySearchTool;
    toolInstructions +=
      "You have access to a vector based memory search tool. Use this when you need to recall specific details, preferences, or context from previous interactions.\n";
  }
  if (useSearch) {
    tools["web_search"] = createWebSearchTool({ maxNumResults: 3, writer });
    toolInstructions +=
      "You have access to an advanced web search tool. When using the web search tool, prefer to use a few searches. If the first result answers the question, respond to the user without calling tools again.\n";
  }
  if (useGetMoreMessages && chatId != null && initialMessageCount != null) {
    tools["get_more_chat_history"] = createGetMoreMessagesTool(
      chatId,
      initialMessageCount,
    );
    tools["get_full_chat_history"] = createGetFullChatHistoryTool(chatId);
    tools["get_messages_from_date"] = createGetMessagesFromDateTool(chatId);
    toolInstructions +=
      "You can fetch older messages from this conversation when the user refers to something earlier in the chat that you don't have in context. Use get_more_chat_history with a limit (e.g. 5 or 10) to retrieve those messages.\n";
    toolInstructions +=
      "Use get_full_chat_history only when the user explicitly asks for the entire conversation, a full summary of the thread, or 'everything we discussed'—not for routine context. It returns up to 24000 tokens.\n";
    toolInstructions +=
      "Use get_messages_from_date with a date (YYYY-MM-DD) when the user asks about what was said on a specific date or 'messages from [date]'.\n";
  }

  if (toolInstructions.length > 0) {
    toolInstructions +=
      "Prefer fewer tool calls when possible. If the first result answers the question, respond to the user without calling tools again.\n";
  }
  return { tools, toolInstructions: toolInstructions.trim() };
};
