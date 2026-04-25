import { randomUUID } from "crypto";

import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  TypeValidationError,
  type UIMessage,
} from "ai";

import { MyUIMessage } from "@/types/ai";
import { ChatRequestSchema, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { CHAT_MODEL, getChatModel, measureAsync } from "@/lib/llm/helpers";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { createLogger } from "@/lib/logger";
import { showMemoriesTool } from "@/lib/llm/archetype/memory";
import { setArchetypeStateTool, viewArchetypeTool } from "@/lib/llm/archetype";
import { getStrataPageById } from "@/data/supabase/strata";
import { buildStrataSystemSuffix } from "@/lib/llm/strata-chat-augmentation";
import { createStrataHubAssistantTools } from "@/lib/llm/strata-assistant-tools";

const logger = createLogger("lib/api/aion-handler.ts");

export type AionDeps = {
  // Clerk's `auth` can accept optional parameters depending on runtime,
  // but the Aion route calls it with no args.
  auth: (...args: any[]) => Promise<any>;
  getSupabaseUserId: (clerkUserId: string) => Promise<{ data: string | null; error: Error | null }>;
  getContext: (args: {
    chatId: string;
    limit?: number;
    persona?: "prometheus" | "spark";
    message: UIMessage;
    memoryEnabled?: boolean;
    persistedSchemasEnabled?: boolean;
  }) => Promise<{
    data: { context: string; messages: UIMessage[] } | null;
    error: string | null;
  }>;
  saveChat: (args: {
    chatId: string;
    messages: UIMessage[];
  }) => Promise<{ ok: boolean; error: Error | null }>;
  deleteChatMessage: (messageId: string) => Promise<{
    ok: boolean;
    error: Error | null;
  }>;
  streamText: (args: any) => {
    // Keep this intentionally loose so we can swap in a fake streamText
    // for E2E (and so Next's typecheck doesn't choke on unioned implementations).
    toUIMessageStream: (args: any) => ReadableStream<any>;
  };
  ensureChatHasTitle: (chatId: string) => Promise<{
    data: string | null;
    error: Error | null;
  }>;
  updateChatSummary: (chatId: string) => Promise<{
    data: string | null;
    error: string | null;
  }>;
  addLatestMessagesToMemory: (
    userId: string,
    messages: UIMessage[],
    chatId?: string
  ) => Promise<{ data: { results: any[]; relations?: any[] } | null; error: string | null }>;
  createMemorySearchTool: (userId: string) => any;
};

export function computeAionGeneratedMessageId(
  validatedMessages: UIMessage[],
  generateId: () => string = randomUUID
): string {
  const lastMessage = validatedMessages[validatedMessages.length - 1];

  if (
    lastMessage?.role === "assistant" &&
    lastMessage.id &&
    lastMessage.parts?.every(
      (p: any) =>
        p.type === "step-start" || (typeof p.type === "string" && p.type.startsWith("tool-"))
    )
  ) {
    return lastMessage.id;
  }

  return generateId();
}

export function createAionHandler(deps: AionDeps) {
  return async function POST(req: Request) {
    const body = await req.json();

    const parseResult = ChatRequestSchema.safeParse(body);
    const memoryEnabled = parseResult.data?.memory;

    if (!parseResult.success) {
      logger.error("POST", "Invalid request body: validation_failed");

      return new Response("Invalid request body", { status: 400 });
    }

    const { message: incomingMessage, id, experience, strataPageId } = parseResult.data;
    const message = incomingMessage as UIMessage;

    const clerkUser = await deps.auth();

    if (!clerkUser || !clerkUser.userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const sbUserIdResult = await deps.getSupabaseUserId(clerkUser.userId);

    if (sbUserIdResult.error || sbUserIdResult.data === null) {
      return new Response("User not found in supabase", { status: 404 });
    }
    const sbUserId = sbUserIdResult.data;

    const messageLimitResult = await checkLlmMessageLimit(sbUserId);

    if (!messageLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: messageLimitResult.error ?? "Too many requests",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    logger.log(
      "POST",
      `Received message metadata: id=${message.id ?? "unknown"} role=${message.role} parts=${message.parts?.length ?? 0}`
    );

    // Save the user message
    try {
      // TODO: Make this async and nonblocking
      if (message.role === "user") {
        await deps.saveChat({
          chatId: id,
          messages: [message], // Just the user's message
        });
      }
      logger.log("POST", "User message saved optimistically");
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));

      logger.error("POST", `Failed to save user message optimistically: ${e.name}`);
      // Continue anyway - onFinish will try to save again
    }

    const stream = createUIMessageStream<MyUIMessage>({
      execute: async ({ writer }) => {
        writer.write({
          type: "data-notification",
          data: { message: "Determining AI model selection", level: "info" },
          transient: true, // Won't be added to message history
        });

        const requestedModel = parseResult.data?.model;
        const selectedModel = requestedModel ? getChatModel(requestedModel) : DEFAULT_CHAT_MODEL;

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
            transient: true,
          });

          const chatContextResult = await deps.getContext({
            chatId: id,
            limit: 30,
            message,
            memoryEnabled,
            persistedSchemasEnabled: true,
          });

          if (chatContextResult.error) {
            logger.error("POST", "Error getting chat context");
            validatedMessages = [message];
          } else {
            validatedMessages = [...(chatContextResult.data?.messages ?? []), message];
            systemPromptForRequest = chatContextResult.data?.context ?? systemPromptForRequest;
          }

          writer.write({
            type: "data-notification",
            data: { message: "Gathered context", level: "info" },
            transient: true,
          });
        } catch (err) {
          if (err instanceof TypeValidationError) {
            logger.error("POST", "Database messages validation failed");
            validatedMessages = [message];
          } else {
            throw err;
          }
        }

        const messages = convertToModelMessages(validatedMessages);

        const streamStartTime = performance.now();

        writer.write({
          type: "data-notification",
          data: { message: "Processing your request...", level: "info" },
          transient: true,
        });

        let hubTools: Record<string, unknown> = {};
        let stepLimit = 5;

        if (experience === "strata_hub") {
          hubTools = createStrataHubAssistantTools(sbUserId) as Record<string, unknown>;
          stepLimit = 8;
        }

        const strataSystem = await buildStrataSystemSuffix({
          experience,
          strataPageId,
          sbUserId,
          fetchPage: getStrataPageById,
        });

        const systemWithStrata = `${systemPromptForRequest}${strataSystem}`;

        const result = deps.streamText({
          model: selectedModel.id,
          messages: messages,
          system: systemWithStrata,
          abortSignal: req.signal,
          experimental_transform: smoothStream({
            delayInMs: 20,
            chunking: /(```[\s\S]*?```|^#{1,6}\s.*$|.*?(?:\n|$))/gm,
          }),
          maxOutputTokens: CHAT_MODEL.maxOutputTokens,
          onError({ error }: { error: unknown }) {
            const e = error instanceof Error ? error : new Error(String(error));

            logger.error("POST", `Stream error: ${e.name}`);
          },
          tools: {
            search_memories: deps.createMemorySearchTool(sbUserId),
            show_memories: showMemoriesTool,
            set_state_archetype: setArchetypeStateTool,
            view_archetype: viewArchetypeTool,
            ...hubTools,
          },
          stopWhen: stepCountIs(stepLimit),
          onFinish() {
            writer.write({
              type: "data-notification",
              data: { message: "Request completed", level: "info" },
              transient: true,
            });
          },
          onStepFinish(step: any) {
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
            generateMessageId: () => computeAionGeneratedMessageId(validatedMessages, randomUUID),
            onError: (error: unknown) => {
              const e = error instanceof Error ? error : new Error(String(error));

              logger.error("POST", `UI stream error: ${e.name}`);
              if (error instanceof Error) return error.message;
              if (typeof error === "string") return error;

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
            onFinish: async ({
              messages,
              isAborted,
              finishReason,
            }: {
              messages: UIMessage[];
              isAborted: boolean;
              finishReason?: string;
            }) => {
              try {
                switch (finishReason) {
                  case "error":
                    logger.error("POST", "LLM encountered an error.");
                    break;
                  case "length":
                    logger.warn("POST", "LLM response stopped due to reaching max limit.");
                    break;
                }

                if (isAborted) {
                  logger.log("POST", "Abort detected: removing optimistically saved user message");
                  void deps.deleteChatMessage((message as any).id);

                  return;
                }

                const onFinishStart = performance.now();
                const streamEndTime = performance.now();
                const modelGenerationTime = streamEndTime - streamStartTime;

                const metrics: Record<string, number> = {
                  modelGenerationTimeMs: modelGenerationTime,
                };

                const { result: saveResult, durationMs: saveChatMs } = await measureAsync(() =>
                  deps.saveChat({ chatId: id, messages })
                );

                metrics.saveChatMs = saveChatMs;

                if (saveResult.error) {
                  logger.error("POST", "Error saving chat");
                  writer.write({
                    type: "data-notification",
                    transient: true,
                    data: {
                      message: "Failed to save latest messages",
                      level: "error",
                    },
                  });

                  return;
                }

                // In AION_TEST_MODE, skip external side-effects that can be slow/flaky/costly
                // (LLM summarization, memory writes, title generation).
                if (process.env.AION_TEST_MODE !== "1") {
                  let ensureChatHasTitleMs: number | undefined;

                  if (messages.length >= 4 && messages.length <= 8) {
                    const { durationMs } = await measureAsync(() => deps.ensureChatHasTitle(id));

                    ensureChatHasTitleMs = durationMs;
                  }

                  const userMessage = message;
                  const aiResponse = messages[messages.length - 1];

                  if (!aiResponse) return;

                  const updateSummaryResult = await measureAsync(() => deps.updateChatSummary(id));

                  metrics.updateChatSummaryMs = updateSummaryResult.durationMs;

                  if (memoryEnabled) {
                    const addMemoryResult = await measureAsync(() =>
                      deps.addLatestMessagesToMemory(sbUserId, [userMessage, aiResponse], id)
                    );

                    metrics.addLatestMessagesToMemoryMs = addMemoryResult.durationMs;
                  }

                  if (ensureChatHasTitleMs !== undefined) {
                    metrics.ensureChatHasTitleMs = ensureChatHasTitleMs;
                  }
                }

                metrics.onFinishTotalMs = performance.now() - onFinishStart;

                logger.log("POST", `onFinish metrics: ${JSON.stringify(metrics)}`);
              } finally {
                writer.write({
                  type: "data-notification",
                  transient: true,
                  data: { message: "Stream completed", level: "info" },
                });
              }
            },
          })
        );
      },
    });

    return createUIMessageStreamResponse({ stream });
  };
}
