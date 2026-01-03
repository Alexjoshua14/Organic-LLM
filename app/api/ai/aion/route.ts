// DIRECTLY COPIED FROM CHAT 12/28/25  and then expanded upon
// PLANNING TO REINTERGRATE EVENTUALLY ONCE I HAVE THINGS STABLE ENOUGH
// REENTRY SHOULD ENABLE/DISABLE various optional params, like persistedSchemas
// alowing currrent chat to stay as is forever and then aion dashboard to be enhanced.

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
  createUIMessageStreamResponse,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
// import systemPrompt from "@/lib/system-prompt";
import { auth } from "@clerk/nextjs/server";

import { deleteChatMessage, getContext, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import {
  addSchemaTool,
  createMemorySearchTool,
  updateSchemaTool,
} from "@/lib/llm/llm-tool-kit";
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
import { MyUIMessage } from "@/types/ai";
import {
  searchAndShowMemoriesTool,
  showMemoriesTool,
} from "@/lib/llm/archetype/memory";
import { setArchetypeStateTool, viewArchetypeTool } from "@/lib/llm/archetype";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/ai/aion/route.ts`);

export async function POST(req: Request) {
  const body = await req.json();

  logger.log("POST", `Received request body: ${JSON.stringify(body)}`);

  const parseResult = ChatRequestSchema.safeParse(body);

  const memoryEnabled = parseResult.data?.memory;

  if (!parseResult.success) {
    logger.error("POST", `Invalid request body: ${parseResult.error.message}`);

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
    if (message.role === "user") {
      await saveChat({
        chatId: id,
        messages: [message], // Just the user's message
      });
    }
    logger.log("POST", "User message saved optimistically");
  } catch (err) {
    logger.error("POST", `Failed to save user message optimistically: ${err}`);
    // Continue anyway - onFinish will try to save again
  }

  const stream = createUIMessageStream<MyUIMessage>({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-notification",
        data: { message: "Determining AI model selection", level: "info" },
        transient: true, // Won't be added to message history
      });

      // Grab the selectedModel from either the parsed request body or default to DEFAULT_CHAT_MODEL
      const requestedModel = parseResult.data?.model;
      const selectedModel = requestedModel
        ? getChatModel(requestedModel)
        : DEFAULT_CHAT_MODEL;

      logger.log(
        "POST",
        `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
      );

      writer.write({
        type: "data-notification",
        data: { message: `Using ${selectedModel.name}`, level: "info" },
        transient: true, // Won't be added to message history
      });

      let validatedMessages: UIMessage[];
      let systemPromptForRequest = SYSTEM_PROMPT;

      try {
        writer.write({
          type: "data-notification",
          data: { message: "Gathering context", level: "info" },
          transient: true, // Won't be added to message history
        });
        const chatContextResult = await getContext({
          chatId: id,
          limit: 30,
          message,
          memoryEnabled,
          persistedSchemasEnabled: true,
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

        // Log chatContext persistedSchema
        if (
          chatContextResult.data &&
          "persistedSchema" in chatContextResult.data
        ) {
          logger.log(
            "POST",
            `persistedSchema: ${JSON.stringify(chatContextResult.data.context)}`
          );
        }

        writer.write({
          type: "data-notification",
          data: { message: "Gathered context", level: "info" },
          transient: true, // Won't be added to message history
        });
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

      // const tools = compileTo ols({ useSearch, useMemory});

      const messages = convertToModelMessages(validatedMessages);

      logger.log("POST", `Calling streamText with model: ${selectedModel}`);

      const streamStartTime = performance.now();
      // 1. Send initial status (transient - won't be added to message history)
      writer.write({
        type: "data-notification",
        data: { message: "Processing your request...", level: "info" },
        transient: true, // This part won't be added to message history
      });

      const result = streamText({
        model: selectedModel.id,
        messages: messages,
        system: systemPromptForRequest,
        abortSignal: req.signal,
        experimental_transform: smoothStream({
          delayInMs: 20, // optional: defaults to 10ms
          chunking: /(```[\s\S]*?```|^#{1,6}\s.*$|.*?(?:\n|$))/gm, // optional: defaults to 'word'
        }),
        maxOutputTokens: CHAT_MODEL.maxOutputTokens, // Cap output for dev guardrails
        onError({ error }) {
          logger.error("POST", `Stream error: ${error}`);
        },
        tools: {
          search_memories: createMemorySearchTool(sbUserId),
          // add_schema: addSchemaTool,
          // update_schema: updateSchemaTool,
          show_memories: showMemoriesTool,
          search_and_show_memories: searchAndShowMemoriesTool,
          set_state_archetype: setArchetypeStateTool,
          view_archetype: viewArchetypeTool,
        },
        stopWhen: stepCountIs(5),
        onFinish() {
          // 4. Update the same data part (reconciliation)

          // 5. Send completion notification (transient)
          writer.write({
            type: "data-notification",
            data: { message: "Request completed", level: "info" },
            transient: true, // Won't be added to message history
          });
        },
        onStepFinish(step) {
          // logger.log("POST", `STEP_FINISH ${JSON.stringify(step, null, 2)}`);
          writer.write({
            type: "data-notification",
            transient: true,
            data: {
              message: `STEP_FINISH ${JSON.stringify(step, null, 2)}`,
              level: "info",
            },
          });
        },
      });

      writer.merge(
        result.toUIMessageStream({
          generateMessageId: () => {
            // Check if last message is assistant with only tool calls
            const lastMessage = validatedMessages[validatedMessages.length - 1];
            if (
              lastMessage?.role === "assistant" &&
              lastMessage.id &&
              lastMessage.parts?.every(
                (p) =>
                  p.type === "step-start" ||
                  (typeof p.type === "string" && p.type.startsWith("tool-"))
              )
            ) {
              // Reuse the ID so response merges into same message
              return lastMessage.id;
            }
            return randomUUID();
          },
          onError: (error) => {
            logger.error("POST", `UI stream error: ${error}`);
            if (error instanceof Error) {
              return error.message;
            }
            if (typeof error === "string") {
              return error;
            }

            writer.write({
              type: "data-notification",
              transient: true,
              data: {
                message: "An unexpected error occured",
                level: "error",
              },
            });

            return "An unexpected error occurred";
          },
          onFinish: async ({ messages, isAborted, finishReason }) => {
            logger.log(
              "POST",
              `onFinish: ----------------------------------${JSON.stringify(messages, null, 2)}`
            );
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
                writer.write({
                  type: "data-notification",
                  transient: true,
                  data: {
                    message: "Saving latest messages",
                    level: "info",
                  },
                });
                const { result: saveResult, durationMs: saveChatMs } =
                  await measureAsync(() => saveChat({ chatId: id, messages }));
                metrics.saveChatMs = saveChatMs;

                if (saveResult.error) {
                  logger.error(
                    "POST",
                    `Error saving chat: ${saveResult.error.message}`
                  );

                  writer.write({
                    type: "data-notification",
                    transient: true,
                    data: {
                      message: "Failed to save latest messages",
                      level: "error",
                    },
                  });

                  return; // Don't continue if save fails
                } else {
                  writer.write({
                    type: "data-notification",
                    transient: true,
                    data: {
                      message: "Saved latest messages",
                      level: "info",
                    },
                  });
                }

                let ensureChatHasTitleMs: number | undefined;

                // Ensure chat title for a sensible range (e.g. after 4–8 messages)
                if (messages.length >= 4 && messages.length <= 8) {
                  writer.write({
                    type: "data-notification",
                    transient: true,
                    data: {
                      message: "Updating conversation title",
                      level: "info",
                    },
                  });
                  const { result: titleResult, durationMs } =
                    await measureAsync(() => ensureChatHasTitle(id));
                  ensureChatHasTitleMs = durationMs;

                  if (titleResult.error) {
                    logger.error(
                      "POST",
                      `Error ensuring chat has title: ${titleResult.error.message}`
                    );
                    writer.write({
                      type: "data-notification",
                      transient: true,
                      data: {
                        message: "Failed to update conversation title",
                        level: "error",
                      },
                    });
                  } else {
                    writer.write({
                      type: "data-notification",
                      transient: true,
                      data: {
                        message: "Updated conversation title",
                        level: "info",
                      },
                    });
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

                writer.write({
                  type: "data-notification",
                  transient: true,
                  data: {
                    message: "Updating conversation summary",
                    level: "info",
                  },
                });
                const updateSummaryResult = await measureAsync(() =>
                  updateChatSummary(id)
                );
                writer.write({
                  type: "data-notification",
                  transient: true,
                  data: {
                    message: "Updated conversation summary",
                    level: "info",
                  },
                });
                metrics.updateChatSummaryMs = updateSummaryResult.durationMs;

                let addMemoryMs: number | undefined;
                if (memoryEnabled) {
                  writer.write({
                    type: "data-notification",
                    transient: true,
                    data: {
                      message: "Updating memory",
                      level: "info",
                    },
                  });
                  const addMemoryResult = await measureAsync(() =>
                    addLatestMessagesToMemory(
                      [userMessage, aiResponse],
                      sbUserId
                    )
                      .catch((err) => {
                        logger.error(
                          "POST",
                          `Error adding latest messages to memory: ${err}`
                        );
                        writer.write({
                          type: "data-notification",
                          transient: true,
                          data: {
                            message: "Failed to update memory",
                            level: "error",
                          },
                        });
                      })
                      .then(() => {
                        writer.write({
                          type: "data-notification",
                          transient: true,
                          data: {
                            message: "Updated memory",
                            level: "info",
                          },
                        });
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

                logger.log(
                  "POST",
                  `onFinish metrics: ${JSON.stringify(metrics)}`
                );
              } catch (err) {
                logger.error("POST", `Error in onFinish callback: ${err}`);
              }
            }

            // Final notification
            writer.write({
              type: "data-notification",
              transient: true,
              data: {
                message: "Stream completed",
                level: "info",
              },
            });
          },
        })
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
