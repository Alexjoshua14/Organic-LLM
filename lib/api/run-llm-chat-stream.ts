import type { ModelMessage, ToolSet, UIMessage, UIMessageStreamWriter } from "ai";
import type { Logger } from "@/lib/logger";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { Result } from "@/types";

import { smoothStream, stepCountIs, streamText } from "ai";
import { GatewayProviderOptions } from "@ai-sdk/gateway";
import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";

import { getMessageCount } from "@/data/supabase/chat";
import { shouldAttemptInitialTitle } from "@/lib/chat/summary-title-cadence";
import { saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { CHAT_MODEL, measureAsync } from "@/lib/llm/helpers";
import { serializeError } from "@/lib/llm/log-error";
import { addLatestMessagesToMemoryForUser } from "@/lib/memory/operations";
import { trackLlmUsageEvent } from "@/lib/usage/track-llm-usage";
import { ChatAIActionEnum, type ChatUIMessage } from "@/types/ai";

export type RunLLMChatStreamParams = {
  writer: UIMessageStreamWriter<ChatUIMessage>;
  logger: Logger;
  chatId: string;
  sbUserId: string;
  assistantMessageId: string;
  selectedModel: { id: string; name: string };
  messages: ModelMessage[];
  systemPromptWithLength: string;
  tools: ToolSet;
  hasTools: boolean;
  maxSteps: number;
  isZeroDataRetention: boolean;
  coalescenceMode: boolean;
  memoryEnabled: boolean | undefined;
  /** When `delphi` or `topic_explore`, automatic transcript ingest to Mem0 is skipped. */
  experience: ChatExperience | undefined;
  userMessage: UIMessage;
  threadHasTitlePromise: Promise<Result<boolean>>;
};

export function runLLMChatStream(params: RunLLMChatStreamParams): void {
  const {
    writer,
    logger,
    chatId,
    sbUserId,
    assistantMessageId,
    selectedModel,
    messages,
    systemPromptWithLength,
    tools,
    hasTools,
    maxSteps,
    isZeroDataRetention,
    coalescenceMode,
    memoryEnabled,
    experience,
    userMessage,
    threadHasTitlePromise,
  } = params;

  const toolNames = Object.keys(tools);

  logger.debug("streamText", "Calling streamText", {
    model: selectedModel.id,
    modelName: selectedModel.name,
    messageCount: messages.length,
    systemPromptLength: systemPromptWithLength.length,
    maxSteps,
    toolChoice: hasTools ? "auto" : "none",
  });

  logger.log("POST", `Calling streamText with model: ${selectedModel.id}`);

  const streamStartTime = performance.now();

  type ChunkBreadcrumb = {
    tMs: number;
    type: string;
    toolName?: string;
    step?: number;
  };
  const chunkRing: ChunkBreadcrumb[] = [];
  const pushChunk = (type: string, extra?: Partial<ChunkBreadcrumb>) => {
    chunkRing.push({
      tMs: Math.round(performance.now() - streamStartTime),
      type,
      ...extra,
    });
    if (chunkRing.length > 24) chunkRing.shift();
  };

  const providerOptionsSummary = {
    zeroDataRetention: isZeroDataRetention,
    openaiInclude: ["reasoning.encrypted_content"] as const,
  };

  logger.debug("streamText", "providerOptions", providerOptionsSummary);

  const result = streamText({
    model: selectedModel.id,
    messages,
    system: systemPromptWithLength,
    experimental_transform: smoothStream({
      delayInMs: 20, // optional: defaults to 10ms
      chunking: /(```[\s\S]*?```|^#{1,6}\s.*$|.*?(?:\n|$))/gm, // optional: defaults to 'word'
    }),
    maxOutputTokens: CHAT_MODEL.maxOutputTokens, // Cap output for dev guardrails
    onError({ error }) {
      logger.error("POST", "Stream error", {
        err: serializeError(error),
        model: selectedModel.id,
        providerOptions: providerOptionsSummary,
        recentChunks: chunkRing.slice(-12),
        toolNames,
      });
    },
    onFinish() {
      writer.write({
        type: "data-notification",
        data: { message: "Request completed", level: "info" },
        transient: true,
      });
    },
    onChunk: (chunk) => {
      const c = chunk.chunk as {
        type: string;
        toolName?: string;
        stepIndex?: number;
      };

      if (c.type === "tool-call") {
        pushChunk(c.type, { toolName: c.toolName, step: c.stepIndex });
      } else {
        pushChunk(c.type, { step: c.stepIndex });
      }
      if (c.type !== "text-delta") {
        logger.debug("streamChunk", c.type, {
          toolName: c.type === "tool-call" ? c.toolName : undefined,
          step: c.stepIndex,
        });
      }
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

  void result.usage
    .then((usage) => {
      if (!usage) return;

      trackLlmUsageEvent({
        ownerId: sbUserId,
        modelId: selectedModel.id,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        totalTokens: usage.totalTokens,
        operation: "chat",
        route: "/api/chat",
      });
    })
    .catch(() => {
      /* optional — usage may be unavailable on abort */
    });

  writer.merge(
    result.toUIMessageStream({
      generateMessageId: () => assistantMessageId,
      onError: (error) => {
        logger.error("POST", "UI stream error", {
          err: serializeError(error),
          model: selectedModel.id,
          stage: "uiStream.toUIMessageStream",
          recentChunks: chunkRing.slice(-12),
        });

        if (error instanceof Error) {
          return error.message;
        }
        if (typeof error === "string") {
          return error;
        }

        return "An unexpected error occurred";
      },
      onFinish: async ({ messages, isAborted, finishReason }) => {
        logger.log("POST", "Stream finished", {
          finishReason: finishReason ?? "unknown",
          isAborted,
          model: selectedModel.id,
          totalChunks: chunkRing.length,
          recentChunks: chunkRing.slice(-12),
        });
        if (!finishReason && !isAborted) {
          logger.error("POST", "No finish reason provided, assuming failure");

          return;
        }
        switch (finishReason) {
          case "error":
            logger.error("POST", "LLM encountered an error.");
            break;
          case "length":
            logger.warn("POST", "LLM response stopped due to reaching max limit.");
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
          `Model (${selectedModel.id}) generated response in ${modelGenerationTime.toFixed(2)}ms (${(modelGenerationTime / 1000).toFixed(2)}s)`
        );

        try {
          const messagesWithModel = messages.map((savedMessage) =>
            savedMessage.role === "assistant"
              ? { ...savedMessage, model: selectedModel.id }
              : savedMessage
          );

          // Use admin client so save succeeds even if the user JWT expired during a long stream (e.g. finish_reason length).
          const { result: saveResult, durationMs: saveChatMs } = await measureAsync(() =>
            saveChat({
              chatId,
              messages: messagesWithModel,
              activeStreamId: null,
              useAdminForSave: true,
              ownerId: sbUserId,
            })
          );

          metrics.saveChatMs = saveChatMs;

          if (saveResult.error) {
            const err = saveResult.error;
            const msg = err instanceof Error ? err.message : String(err);

            logger.error("POST", `Error saving chat: ${msg}`);

            return; // Don't continue if save fails
          }

          // Fire-and-forget post-processing (don't block `onFinish`)
          void (async () => {
            let ensureChatHasTitleMs: number | undefined;

            // Use title status fetched earlier (or from request); by now the promise has had time to resolve
            const threadHasTitleResult = await threadHasTitlePromise;
            const threadAlreadyHasTitle = threadHasTitleResult.data === true;

            // Use persisted message count so title generation is based on DB state, not transient stream state.
            const messageCountResult = await getMessageCount(chatId);
            const persistedMessageCount = messageCountResult.data ?? messages.length;

            if (messageCountResult.error) {
              logger.error("POST", "Error getting message count for title generation");
            }

            // First completed user/assistant turn (persisted count ≥ 2), when thread still has no title
            if (
              shouldAttemptInitialTitle({
                persistedMessageCount,
                threadAlreadyHasTitle,
              })
            ) {
              const { result: titleResult, durationMs } = await measureAsync(() =>
                ensureChatHasTitle(chatId)
              );

              ensureChatHasTitleMs = durationMs;

              if (titleResult.error) {
                logger.error("POST", "Error ensuring chat has title");
              } else {
                writer.write({
                  type: "data-notification",
                  data: {
                    message: "chat-title-generated",
                    level: "info",
                  },
                  transient: true,
                });
              }
            } else if (threadAlreadyHasTitle) {
              logger.log("POST", "Chat already has title; skipping title generation");
            } else {
              logger.log(
                "POST",
                `Skipping title generation: only ${persistedMessageCount} persisted messages (need >= 2 for first exchange) or thread already titled`
              );
            }

            const aiResponse = messages[messages.length - 1];

            if (!aiResponse) {
              logger.error("POST", "No AI response found in messages; skipping post-processing");

              return;
            }

            const updateSummaryResult = await measureAsync(() => updateChatSummary(chatId));

            metrics.updateChatSummaryMs = updateSummaryResult.durationMs;

            if (memoryEnabled && experience !== "delphi" && experience !== "topic_explore") {
              const addMemoryResult = await measureAsync(() =>
                addLatestMessagesToMemoryForUser(sbUserId, [userMessage, aiResponse], chatId).then(
                  (r) => {
                    if (r.error) {
                      logger.error("POST", "Error adding latest messages to memory");
                    }

                    return r.data;
                  }
                )
              );

              metrics.addLatestMessagesToMemoryMs = addMemoryResult.durationMs;
            }

            if (updateSummaryResult.result?.error) {
              logger.error("POST", "Error updating chat summary");
            }

            if (coalescenceMode && !isZeroDataRetention) {
              const { enqueueArtifactSyncFromChat } = await import(
                "@/lib/spatial-artifacts/sync/sync-worker"
              );

              enqueueArtifactSyncFromChat({
                ownerId: sbUserId,
                threadId: chatId,
                coalescenceMode: true,
                messages: messagesWithModel,
              });
            }

            metrics.onFinishTotalMs = performance.now() - onFinishStart;
            if (ensureChatHasTitleMs !== undefined) {
              metrics.ensureChatHasTitleMs = ensureChatHasTitleMs;
            }

            logger.log("POST", `onFinish metrics: ${JSON.stringify(metrics)}`);
          })().catch((err) => {
            logger.error("POST", "Error in post-processing task", {
              err: serializeError(err),
              model: selectedModel.id,
            });
          });
        } catch (err) {
          logger.error("POST", "Error in onFinish callback", {
            err: serializeError(err),
            model: selectedModel.id,
            metrics,
          });
        }
      },
    })
  );
}
