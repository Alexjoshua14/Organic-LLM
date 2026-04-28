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
import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

import { getContext, saveChat } from "@/lib/chat/chat-store";
import { getMessageCount, getThreadHasTitle } from "@/data/supabase/chat";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import {
  createGetFullChatHistoryTool,
  createGetMessagesFromDateTool,
  createGetMoreMessagesTool,
  createMermaidDiagramTool,
  createMemorySearchTool,
  createWebSearchTool,
  type WebSearchStreamWriter,
} from "@/lib/llm/llm-tool-kit";
import { createLogger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";
import { addLatestMessagesToMemoryForUser } from "@/lib/memory/operations";
import { ChatRequestSchema, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import {
  CHAT_MODEL,
  getChatModel,
  getChatResponseLengthInstruction,
  measureAsync,
} from "@/lib/llm/helpers";
import { serializeError } from "@/lib/llm/log-error";
import { ChatUIMessage, ChatAIActionEnum } from "@/types/ai";
import {
  ARCADIA_HELP_RESPONSE,
  getLastUserMessageText,
  isArcadiaHelpQuery,
} from "@/lib/arcadia/help-response";
import { getStrataPageById } from "@/data/supabase/strata";
import { getStrataAssistantPersona } from "@/lib/personas/strata-assistant";
import { buildStrataSystemSuffix } from "@/lib/llm/strata-chat-augmentation";
import { createStrataHubAssistantTools } from "@/lib/llm/strata-assistant-tools";
import { createStrataKnowledgeGraphTools } from "@/lib/llm/strata-knowledge-graph-tools";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const MAX_TOOL_STEPS = 10;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const body = await req.json();

  const parseResult = ChatRequestSchema.safeParse(body);
  // Grab the selectedModel from either the parsed request body or default to DEFAULT_CHAT_MODEL
  const requestedModel = parseResult.data?.model;
  const selectedModel = requestedModel ? getChatModel(requestedModel) : DEFAULT_CHAT_MODEL;

  const memoryEnabled = parseResult.data?.memory;

  logger.log(
    "POST",
    `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
  );

  if (!parseResult.success) {
    logger.error("POST", "Invalid request body: validation_failed");

    return new Response(JSON.stringify({ error: "Invalid request body", status: 400 }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    message: incomingMessage,
    id,
    zeroDataRetention,
    experience,
    strataPageId,
    messageSearch,
    knowledgeSearch,
    strataAssistantPersona,
  } = parseResult.data;
  const message = incomingMessage as UIMessage;

  // Zero Data Retention Policy is in regards to external LLMs, not Organic LLM at this time
  // If enabled, we only use LLMs that have ZDR compatibility
  const isZeroDataRetention = zeroDataRetention === true;

  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized", status: 401 }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return new Response(
      JSON.stringify({
        error: "User not found in supabase",
        status: 404,
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const sbUserId = sbUserIdResult.data;

  const messageLimitResult = await checkLlmMessageLimit(sbUserId);

  if (!messageLimitResult.success) {
    return new Response(
      JSON.stringify({
        error: messageLimitResult.error ?? "Too many requests",
        status: 429,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Start fetching thread title status early; result is only needed in onFinish (non-blocking).
  // We rely on DB state here to avoid false positives from stale client hints.
  const threadHasTitlePromise = getThreadHasTitle(id);

  /**
   * Generate stable message ID for this entire response
   */
  const assistantMessageId = randomUUID();

  logger.log(
    "POST",
    `Received message metadata: id=${message.id ?? "unknown"} role=${message.role} parts=${message.parts?.length ?? 0}`
  );

  // Save the user message

  saveChat({ chatId: id, messages: [message] })
    .then(() => {
      logger.log("POST", "User message saved optimistically");
    })
    .catch((err) => {
      const e = err instanceof Error ? err : new Error(String(err));

      logger.error("POST", `Failed to save user message: ${e.name}`);
    });

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      const isStrataExperience = experience === "strata_hub" || experience === "strata_page";

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
        // `getContext` returns DB history only; we always append the live `message` from the client
        // so the main model sees the user's exact turn (Arcadia Mem0 rewrite never replaces this).
        const chatContextResult = await getContext({
          chatId: id,
          limit: isStrataExperience ? 30 : 10,
          message,
          memoryEnabled,
          persistedSchemasEnabled: isStrataExperience,
          experience,
        });

        if (chatContextResult.error) {
          logger.error("POST", "Error getting chat context", {
            error: chatContextResult.error,
          });
          validatedMessages = [message];
          systemPromptForRequest =
            SYSTEM_PROMPT +
            "\n\n[System note: Chat context (conversation summary and recent messages) could not be loaded for this request. Only the user's latest message is in context. Use get_more_chat_history or get_full_chat_history if you need prior conversation or memories to answer well.]";
          logger.debug("context", "Context failed; using only incoming message");
        } else {
          validatedMessages = [...(chatContextResult.data?.messages ?? []), message];
          systemPromptForRequest = chatContextResult.data?.context ?? systemPromptForRequest;
          logger.debug("context", "Context gathered", {
            historyMessageCount: chatContextResult.data?.messages?.length ?? 0,
            contextLength: chatContextResult.data?.context?.length ?? 0,
            memoriesCount: chatContextResult.data?.memories?.length ?? 0,
          });
        }
      } catch (err) {
        if (err instanceof TypeValidationError) {
          logger.error("POST", "Database messages validation failed");
          validatedMessages = [message];
          systemPromptForRequest =
            SYSTEM_PROMPT +
            "\n\n[System note: Chat context (conversation summary and recent messages) could not be loaded for this request. Only the user's latest message is in context. Use get_more_chat_history or get_full_chat_history if you need prior conversation or memories to answer well.]";
        } else {
          throw err;
        }
      }

      systemPromptForRequest += await buildStrataSystemSuffix({
        experience,
        strataPageId,
        sbUserId,
        fetchPage: getStrataPageById,
      });

      if (experience === "strata_page" && strataAssistantPersona) {
        systemPromptForRequest +=
          getStrataAssistantPersona(strataAssistantPersona).getSystemPromptAugmentation();
      }

      logger.log(
        "POST",
        `
    System Prompt: ${systemPromptForRequest.length} characters
    \n\n--------------------------------\n\n
    ${validatedMessages.length} messages being sent to LLM
    Model: ${selectedModel.id} (${selectedModel.name})
    `
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

      // Arcadia: respond with prepared "what can you do" / help without calling the model
      if (experience === "arcadia") {
        const lastText = getLastUserMessageText(message);

        if (isArcadiaHelpQuery(lastText)) {
          const textPartId = generateId();

          writer.write({ type: "text-start", id: textPartId });
          writer.write({
            type: "text-delta",
            id: textPartId,
            delta: ARCADIA_HELP_RESPONSE,
          });
          writer.write({ type: "text-end", id: textPartId });
          const assistantMessage: UIMessage = {
            id: assistantMessageId,
            role: "assistant",
            parts: [{ type: "text", text: ARCADIA_HELP_RESPONSE }],
          };
          const saveResult = await saveChat({
            chatId: id,
            messages: [...validatedMessages, assistantMessage],
            activeStreamId: null,
            useAdminForSave: true,
            ownerId: sbUserId,
          });

          if (saveResult.error) {
            logger.error("POST", "Failed to save Arcadia help response", {
              error: saveResult.error,
            });
          }

          return;
        }
      }

      writer.write({
        type: "data-notification",
        data: { message: `Using ${selectedModel.name}`, level: "info" },
        transient: true,
      });

      const messages = convertToModelMessages(validatedMessages);
      const initialMessageCount = validatedMessages.length;
      const { tools, toolInstructions } = await compileTools({
        useSearch: parseResult.data.webSearch ?? false,
        useMemory: parseResult.data.memory ?? false,
        useGetMoreMessages: messageSearch ?? true,
        useKnowledgeSearch: Boolean(knowledgeSearch) && experience === "strata_page",
        experience,
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
      });

      const hasTools = toolNames.length > 0;
      // One round of tool use + one round of response; avoids redundant multi-step searches
      let maxSteps = hasTools ? MAX_TOOL_STEPS : 2;

      if (experience === "strata_hub") {
        maxSteps = Math.min(maxSteps, 8);
      }

      if (hasTools) {
        systemPromptForRequest += `\n\nTool Instructions:\n${toolInstructions}`;
      }

      if (parseResult.data.speechFriendly) {
        systemPromptForRequest += `\n\nOutput format (speech-friendly mode): Format your response for both clear on-screen reading and later use as a script for audio. Use clear structure, headings, and visually appealing formatting. A separate pipeline will convert your text into a speech-friendly script and handle text-to-speech, so focus on clarity, structure, and readability—not on pronouncing abbreviations or avoiding punctuation.`;
      }

      if (experience === "arcadia") {
        systemPromptForRequest +=
          `\n\n[Arcadia mode — keep replies short]\n` +
          `- Target ~50–120 words per reply. Minimize vertical height; mobile should rarely need to scroll for a single answer.\n` +
          `- Lead with the answer in 1–2 sentences. Use bullets or a tiny list only when necessary; avoid long paragraphs.\n` +
          `- If more is needed: give a one-screen summary and say "I can expand on X or Y" instead of expanding in the same message.\n` +
          `- Prefer tool use over prose for complex tasks; then respond with a compact synthesis, not raw output.\n` +
          `- When the user asks for depth, add a little at a time (one focused follow-up), not a long block.\n`;
      }

      writer.write({
        type: "data-aiAction",
        data: { action: ChatAIActionEnum.Processing, message: "Thinking..." },
        transient: true,
      });

      const systemPromptWithLength =
        systemPromptForRequest +
        "\n\n<response_length>\n" +
        getChatResponseLengthInstruction() +
        "\n</response_length>";

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
                  chatId: id,
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
                const messageCountResult = await getMessageCount(id);
                const persistedMessageCount = messageCountResult.data ?? messages.length;

                if (messageCountResult.error) {
                  logger.error("POST", "Error getting message count for title generation");
                }

                // Ensure chat has an LLM-generated title only when we have enough persisted messages and don't already have one
                if (!threadAlreadyHasTitle && persistedMessageCount >= 4) {
                  const { result: titleResult, durationMs } = await measureAsync(() =>
                    ensureChatHasTitle(id)
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
                    `Skipping title generation: only ${persistedMessageCount} persisted messages (need >= 4)`
                  );
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

                const updateSummaryResult = await measureAsync(() => updateChatSummary(id));

                metrics.updateChatSummaryMs = updateSummaryResult.durationMs;

                if (memoryEnabled) {
                  const addMemoryResult = await measureAsync(() =>
                    addLatestMessagesToMemoryForUser(sbUserId, [userMessage, aiResponse], id).then(
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

/** Which tools `streamText` may call for this request; drives companion system text. */
type CompileToolsParams = {
  useSearch: boolean;
  useMemory: boolean;
  /** When true with `chatId` + `initialMessageCount`, registers history-fetch tools. */
  useGetMoreMessages?: boolean;
  /** Strata page KG stubs (experimental). */
  useKnowledgeSearch?: boolean;
  /** Adds Arcadia-only tools (e.g. Mermaid) when `arcadia`. */
  experience?: string;
  /** Required for history tools. */
  chatId?: string;
  /** `validatedMessages.length` — how many turns the model already has in context. */
  initialMessageCount?: number;
  sbUserId: string;
  writer?: WebSearchStreamWriter;
};

/**
 * Builds the `tools` object and a human-readable **Tool Instructions** appendix for the system prompt.
 *
 * Memory search uses the tool argument verbatim (rewrite lives only in `getContext` for Arcadia).
 */
const compileTools = async ({
  useSearch,
  useMemory,
  useGetMoreMessages,
  useKnowledgeSearch,
  experience,
  chatId,
  initialMessageCount,
  sbUserId,
  writer,
}: CompileToolsParams): Promise<{ tools: ToolSet; toolInstructions: string }> => {
  // Shape expected by AI SDK `streamText({ tools })`
  const tools: ToolSet = {};
  let toolInstructions = "";

  if (useMemory) {
    const memorySearchTool = createMemorySearchTool(sbUserId, writer);

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
    tools["get_more_chat_history"] = createGetMoreMessagesTool(chatId, initialMessageCount);
    tools["get_full_chat_history"] = createGetFullChatHistoryTool(chatId);
    tools["get_messages_from_date"] = createGetMessagesFromDateTool(chatId);
    toolInstructions +=
      "You can fetch older messages from this conversation when the user refers to something earlier in the chat that you don't have in context. Use get_more_chat_history with a limit (e.g. 5 or 10) to retrieve those messages.\n";
    toolInstructions +=
      "Use get_full_chat_history only when the user explicitly asks for the entire conversation, a full summary of the thread, or 'everything we discussed'—not for routine context. It returns up to 24000 tokens.\n";
    toolInstructions +=
      "Use get_messages_from_date with a date (YYYY-MM-DD) when the user asks about what was said on a specific date or 'messages from [date]'.\n";
  }

  if (experience === "arcadia") {
    tools["make_mermaid_diagram"] = createMermaidDiagramTool({ writer });
    toolInstructions +=
      "You can generate Mermaid diagrams using make_mermaid_diagram. Use it when a diagram would clarify a process, architecture, or relationships. Return the diagram in a mermaid code block so the UI can render it.\n";
  }

  if (experience === "strata_hub") {
    Object.assign(tools, createStrataHubAssistantTools(sbUserId));
    toolInstructions +=
      "You can navigate the user's Strata documents with navigate_to_strata_page (UUID or title fragment) and search or list them with search_strata_pages.\n";
  }

  if (useKnowledgeSearch && experience === "strata_page") {
    Object.assign(tools, createStrataKnowledgeGraphTools());
    toolInstructions +=
      "Knowledge graph tools are available but persistence is not fully implemented yet; prefer summarizing Strata page content and use these tools only when explicitly helpful. Stubs may return placeholder data.\n";
  }

  if (toolInstructions.length > 0) {
    toolInstructions +=
      "Prefer fewer tool calls when possible. If the first result answers the question, respond to the user without calling tools again.\n";
    toolInstructions +=
      "When you need both web search and memory search (or multiple independent tools), call them in the same turn when possible so the system can run them in parallel and reduce latency.\n";
  }

  return { tools, toolInstructions: toolInstructions.trim() };
};
