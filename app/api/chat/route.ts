import { randomUUID } from "crypto";

import {
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

import { saveChat } from "@/lib/chat/chat-store";
import { getThreadArcadiaStarterKey, getThreadHasTitle } from "@/data/supabase/chat";
import { isAdminUser } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { getLastUserMessageText } from "@/lib/arcadia/help-response";
import {
  classifyTaskTier,
  chatModelForGatewayId,
  tierToGatewayModelId,
} from "@/lib/llm/auto-model-router";
import { getChatModel } from "@/lib/llm/helpers";
import {
  AUTO_CHAT_MODEL_ID,
  AUTO_RESOLVED_SONNET_MODEL_ID,
  ChatModels,
  ChatRequestSchema,
  DEFAULT_CHAT_MODEL,
} from "@/lib/schemas/chat";
import { ChatUIMessage, ChatAIActionEnum } from "@/types/ai";
import { tryArcadiaChatHelpShortcut } from "@/lib/api/arcadia-chat-help-shortcut";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { loadMainChatTurnContext, getContextMessageLimit } from "@/lib/api/chat-turn-context";
import { loadArcadiaChatTurnContext } from "@/lib/api/arcadia-chat-turn-context";
import { scheduleArcadiaContextCondensation } from "@/lib/api/schedule-arcadia-context-condensation";
import {
  assertLlmInputWithinHardCap,
  estimateLlmInputTokens,
} from "@/lib/api/llm-input-token-guard";
import { buildBudgetFromAssembledTurn } from "@/lib/api/main-chat-context-budget";
import { computeMainChatMaxSteps } from "@/lib/api/chat-max-steps";
import {
  appendMainChatPostToolSystemFragments,
  appendStrataMainChatSystemFragments,
  wrapSystemPromptWithResponseLength,
} from "@/lib/api/chat-system-prompt";
import { appendIntrospectionMainChatSystemFragments } from "@/lib/api/introspection-system-prompt";
import { resolveMemoryEnabledForExperience } from "@/lib/chat/chat-experience";
import { resolveChatStarterPromptByKey } from "@/lib/chat/chat-style-starters";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { runLLMChatStream } from "@/lib/api/run-llm-chat-stream";
import { canSeeErrorDetail } from "@/lib/observability/error-access";
import { reportServerError } from "@/lib/observability/report-server-error";
import {
  CHAT_STAGES,
  markErrorReported,
  readReportedError,
  serverErrorResponse,
  shouldIncludeErrorDetail,
  summarizeZodIssues,
  toServerErrorBody,
  type ServerErrorContext,
  type ServerErrorStage,
} from "@/lib/observability/server-error";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const ROUTE = "/api/chat";

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const startedAt = Date.now();

  /**
   * Where we are in the turn. Every failure carries this so a 500 says *which* step
   * broke (auth gate, context load, tool compile, model stream, …) instead of only
   * that "a server error occurred".
   */
  let stage: ServerErrorStage = CHAT_STAGES.parseBody;

  let chatId: string | undefined;
  let experienceHint: string | undefined;
  let modelIdHint: string | undefined;
  let clerkUserIdHint: string | undefined;

  /** Baseline (dev / explicit opt-in); upgraded once we know the caller is an admin. */
  let detailAccess = shouldIncludeErrorDetail(false);

  const errorContext = (extra?: ServerErrorContext): ServerErrorContext => ({
    chatId,
    experience: experienceHint,
    model: modelIdHint,
    clerkUserId: clerkUserIdHint,
    elapsedMs: Date.now() - startedAt,
    ...extra,
  });

  /**
   * Log the failure as one structured line, file it for `/admin/errors`, and answer
   * with JSON. Never let an unhandled throw reach Next.js, which would return an
   * opaque HTML error page that the chat client then renders verbatim.
   */
  const fail = async (
    error: unknown,
    options: {
      stage?: ServerErrorStage;
      status?: number;
      publicMessage?: string;
      context?: ServerErrorContext;
    } = {}
  ): Promise<Response> => {
    const report = reportServerError({
      error,
      route: ROUTE,
      stage: options.stage ?? stage,
      status: options.status ?? 500,
      context: errorContext(options.context),
    });

    detailAccess = await canSeeErrorDetail(clerkUserIdHint);

    return serverErrorResponse(report, {
      publicMessage: options.publicMessage,
      includeDetail: detailAccess,
    });
  };

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch (error) {
      return await fail(error, {
        stage: CHAT_STAGES.parseBody,
        status: 400,
        publicMessage: "Invalid JSON",
      });
    }

    stage = CHAT_STAGES.validateBody;

    // Pull identifiers off the raw body so a schema failure is still traceable to a thread.
    if (body && typeof body === "object") {
      const raw = body as Record<string, unknown>;

      if (typeof raw.id === "string") chatId = raw.id;
      if (typeof raw.experience === "string") experienceHint = raw.experience;
    }

    const parseResult = ChatRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const issues = summarizeZodIssues(parseResult.error.issues);

      return await fail(new Error(`Request body failed validation: ${issues}`), {
        stage: CHAT_STAGES.validateBody,
        status: 400,
        publicMessage: "Invalid request body",
        context: { issueCount: parseResult.error.issues.length },
      });
    }

    const {
      message: incomingMessage,
      id,
      zeroDataRetention,
      coalescenceMode,
      experience,
      chatStyle,
      strataPageId,
      messageSearch,
      knowledgeSearch,
      strataAssistantPersona,
      model: requestedModel,
      effort: requestedEffort,
      memory: requestedMemory,
      delphiDisplay,
    } = parseResult.data;
    const message = incomingMessage as UIMessage;
    const memoryEnabled = resolveMemoryEnabledForExperience(experience, requestedMemory);

    chatId = id;
    experienceHint = experience ?? undefined;

    // Zero Data Retention Policy is in regards to external LLMs, not Organic LLM at this time
    // If enabled, we only use LLMs that have ZDR compatibility
    const isZeroDataRetention = zeroDataRetention === true;

    let selectedModel = requestedModel ? getChatModel(requestedModel) : DEFAULT_CHAT_MODEL;

    if (selectedModel.id === AUTO_CHAT_MODEL_ID) {
      if (experience === "delphi") {
        const userText = getLastUserMessageText(message);
        const tier = classifyTaskTier(userText);
        const gatewayId = tierToGatewayModelId(tier, isZeroDataRetention);

        selectedModel = getChatModel(chatModelForGatewayId(gatewayId));
        logger.log(
          "POST",
          `Model selection branch: delphi_auto_tier -> ${selectedModel.id} (tier=${tier})`
        );
      } else {
        const sonnet =
          ChatModels.find((m) => m.id === AUTO_RESOLVED_SONNET_MODEL_ID) ?? DEFAULT_CHAT_MODEL;

        selectedModel = getChatModel(sonnet);
        logger.log("POST", `Model selection branch: auto_sonnet_default -> ${selectedModel.id}`);
      }
    } else {
      logger.log("POST", `Model selection explicit -> ${selectedModel.id}`);
    }

    modelIdHint = selectedModel.id;

    logger.log(
      "POST",
      `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
    );

    stage = CHAT_STAGES.authGate;

    const authGate = await requireLlmChatActor();

    if (authGate.error != null) {
      return authGate.error;
    }

    const { sbUserId, clerkUserId } = authGate.data!;

    clerkUserIdHint = clerkUserId;
    stage = CHAT_STAGES.modelGate;

    // Admin-only models: check the canonical registry entry (the client payload isn't trusted
    // to carry the adminOnly flag) and fall back to the default model for non-admins.
    const canonicalModel = ChatModels.find((m) => m.id === selectedModel.id);

    if (canonicalModel?.adminOnly) {
      const isAdmin = await isAdminUser(clerkUserId);

      // Admins get full error detail without a second profile read on the failure path.
      if (isAdmin) detailAccess = true;

      if (!isAdmin) {
        logger.error(
          "POST",
          `Non-admin requested admin-only model ${selectedModel.id}; falling back to ${DEFAULT_CHAT_MODEL.id}`
        );
        selectedModel = DEFAULT_CHAT_MODEL;
        modelIdHint = selectedModel.id;
      }
    }

    stage = CHAT_STAGES.requestSetup;

    // Start fetching thread title status early; result is only needed in onFinish (non-blocking).
    // We rely on DB state here to avoid false positives from stale client hints.
    const threadHasTitlePromise = getThreadHasTitle(id).catch((err) => {
      reportServerError({
        error: err,
        route: ROUTE,
        stage: CHAT_STAGES.requestSetup,
        status: 200,
        context: errorContext({ operation: "getThreadHasTitle" }),
      });

      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    });

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
        reportServerError({
          error: err,
          route: ROUTE,
          stage: CHAT_STAGES.persistUserMessage,
          status: 200,
          context: errorContext({ messageId: message.id }),
        });
      });

    const stream = createUIMessageStream<ChatUIMessage>({
      // The SDK masks server errors as "An error occurred." by default. Replace that
      // with the structured body so the client can show a stage + error id (and, for
      // admins, the underlying message).
      onError: (error) => {
        const alreadyReported = readReportedError(error);

        if (alreadyReported) {
          return JSON.stringify(alreadyReported);
        }

        const report = reportServerError({
          error,
          route: ROUTE,
          stage: CHAT_STAGES.streamTransport,
          status: 200,
          context: errorContext(),
        });

        return JSON.stringify(toServerErrorBody(report, { includeDetail: detailAccess }));
      },
      execute: async ({ writer }) => {
        try {
          writer.write({
            type: "data-aiAction",
            data: {
              action: ChatAIActionEnum.Processing,
              message: "Gathering context",
            },
            transient: true,
          });

          stage = CHAT_STAGES.loadContext;

          const loadTurnContext =
            experience === "arcadia"
              ? () =>
                  loadArcadiaChatTurnContext({
                    logger,
                    chatId: id,
                    message,
                    memoryEnabled,
                  })
              : () =>
                  loadMainChatTurnContext({
                    logger,
                    chatId: id,
                    message,
                    memoryEnabled,
                    experience,
                  });

          const {
            validatedMessages,
            systemPromptForRequest: afterContext,
            tokenBreakdown,
            packedMessageCount,
            totalThreadMessages,
            scheduleBackgroundCondensation,
          } = await loadTurnContext();

          if (experience === "arcadia" && scheduleBackgroundCondensation) {
            scheduleArcadiaContextCondensation({
              chatId: id,
              modelId: selectedModel.id,
            });
          }

          stage = CHAT_STAGES.systemPrompt;

          let systemPromptForRequest = await appendStrataMainChatSystemFragments({
            systemPromptForRequest: afterContext,
            experience,
            strataPageId,
            sbUserId,
            strataAssistantPersona,
          });

          systemPromptForRequest = await appendIntrospectionMainChatSystemFragments({
            systemPromptForRequest,
            experience,
            chatId: id,
            sbUserId,
          });

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

          stage = CHAT_STAGES.arcadiaShortcut;

          if (
            await tryArcadiaChatHelpShortcut({
              experience,
              message,
              validatedMessages,
              assistantMessageId,
              chatId: id,
              sbUserId,
              writer,
              logger,
            })
          ) {
            return;
          }

          writer.write({
            type: "data-notification",
            data: { message: `Using ${selectedModel.name}`, level: "info" },
            transient: true,
          });

          stage = CHAT_STAGES.compileTools;

          const messages = convertToModelMessages(validatedMessages);
          const initialMessageCount = validatedMessages.length;
          const { tools, toolInstructions } = await compileChatTools({
            useSearch: parseResult.data.webSearch ?? false,
            useMemory: parseResult.data.memory ?? false,
            useGetMoreMessages: messageSearch ?? true,
            useKnowledgeSearch: Boolean(knowledgeSearch) && experience === "strata_page",
            experience,
            chatStyle,
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
          const maxSteps = computeMainChatMaxSteps({ experience, hasTools });

          let arcadiaStarterPriming: string | undefined;

          if (experience === "arcadia") {
            const starterKeyResult = await getThreadArcadiaStarterKey(id);

            if (starterKeyResult.error) {
              logger.error("POST", "Failed to load Arcadia starter key", {
                error: starterKeyResult.error.message,
              });
            } else if (starterKeyResult.data) {
              arcadiaStarterPriming = resolveChatStarterPromptByKey(starterKeyResult.data);
              if (!arcadiaStarterPriming) {
                logger.warn("POST", "Ignoring unknown Arcadia starter key", {
                  key: starterKeyResult.data,
                });
              }
            }
          }

          systemPromptForRequest = appendMainChatPostToolSystemFragments({
            systemPromptForRequest,
            hasTools,
            toolInstructions,
            speechFriendly: parseResult.data.speechFriendly,
            experience,
            chatStyle,
            delphiDisplay,
            arcadiaStarterPriming,
          });

          writer.write({
            type: "data-aiAction",
            data: { action: ChatAIActionEnum.Processing, message: "Thinking..." },
            transient: true,
          });

          const systemPromptWithLength = wrapSystemPromptWithResponseLength(
            systemPromptForRequest,
            {
              experience,
              delphiDisplay,
            }
          );

          const inputTokenEstimate = estimateLlmInputTokens({
            systemPrompt: systemPromptWithLength,
            toolInstructions,
            messages: validatedMessages,
          });

          try {
            assertLlmInputWithinHardCap(inputTokenEstimate);
          } catch (capError) {
            logger.error("POST", "LLM input hard cap exceeded", {
              totalTokens: inputTokenEstimate.totalTokens,
              hardCap: inputTokenEstimate.hardCapTokens,
              err: capError instanceof Error ? capError.message : String(capError),
            });

            writer.write({
              type: "data-notification",
              data: {
                message:
                  "This turn would exceed the safe 300k input token limit. Shorten your message or start a new thread.",
                level: "error",
              },
              transient: true,
            });
            writer.write({
              type: "data-aiAction",
              data: {
                action: ChatAIActionEnum.Errored,
                message: "Input too large for safe LLM call",
              },
              transient: true,
            });

            return;
          }

          stage = CHAT_STAGES.contextBudget;

          const contextBudget = await buildBudgetFromAssembledTurn({
            modelId: selectedModel.id,
            draftMessage: message,
            validatedMessages,
            contextSystemPrompt: afterContext,
            finalSystemPrompt: systemPromptWithLength,
            toolInstructions,
            tokenBreakdown,
            packedMessageCount,
            totalThreadMessages,
            contextMessageLimit:
              experience === "arcadia" ? undefined : getContextMessageLimit(experience),
          });

          writer.write({
            type: "data-context-budget",
            data: contextBudget,
          });

          stage = CHAT_STAGES.llmStream;

          runLLMChatStream({
            writer,
            logger,
            chatId: id,
            sbUserId,
            assistantMessageId,
            selectedModel,
            effort: requestedEffort,
            messages,
            systemPromptWithLength,
            tools,
            hasTools,
            maxSteps,
            isZeroDataRetention,
            coalescenceMode: coalescenceMode === true,
            memoryEnabled,
            experience,
            userMessage: message,
            threadHasTitlePromise,
          });
        } catch (error) {
          // Headers are already sent, so this can't be an HTTP error status. Surface the
          // failure in-band instead: a data part the UI can render plus a marked rethrow
          // that `onError` turns into a structured error chunk.
          const report = reportServerError({
            error,
            route: ROUTE,
            stage,
            status: 200,
            context: errorContext(),
          });

          detailAccess = await canSeeErrorDetail(clerkUserIdHint);

          const body = toServerErrorBody(report, { includeDetail: detailAccess });

          try {
            writer.write({ type: "data-error", data: body, transient: true });
            writer.write({
              type: "data-aiAction",
              data: {
                action: ChatAIActionEnum.Errored,
                message: `Failed during ${report.stage} (${report.errorId})`,
              },
              transient: true,
            });
          } catch {
            // The writer can already be closed (e.g. the client disconnected). The
            // original failure still has to reach `onError`, so swallow this one.
          }

          throw markErrorReported(error instanceof Error ? error : new Error(String(error)), body);
        }
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream }) {
        // Resumability is a nice-to-have: a missing/broken REDIS_URL must not take the
        // response down with it (it used to surface as an unhandled 500 with no context).
        try {
          const streamId = generateId();
          const streamContext = createResumableStreamContext({ waitUntil: after });

          await streamContext.createNewResumableStream(streamId, () => stream);

          await saveChat({ chatId: id, activeStreamId: streamId });
        } catch (error) {
          reportServerError({
            error,
            route: ROUTE,
            stage: CHAT_STAGES.resumableStream,
            status: 200,
            context: errorContext({
              hint: "resumable stream setup failed — check REDIS_URL; the turn itself still streamed",
            }),
          });
        }
      },
    });
  } catch (error) {
    return await fail(error);
  }
}
