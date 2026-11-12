import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";
import type { RabbitHoleNode } from "@/lib/schemas/rabbitHoleSchemas";

import { randomUUID } from "crypto";

import { after } from "next/server";
import {
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";

import { releaseAfterStream } from "@/lib/chat/release-after-stream";
import { acquireChatStreamLease } from "@/lib/chat/stream-admission";
import { saveChat } from "@/lib/chat/chat-store";
import { stampTurnWithActivatedMemories } from "@/lib/chat/stamp-activated-memories";
import { expandActivatedMemoriesForModel } from "@/lib/memory/activated-thread-memories";
import { consumeChatSseStream } from "@/lib/chat/resumable-sse-stream";
import { getThreadArcadiaStarterKey, getThreadHasTitle } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { getLastUserMessageText } from "@/lib/arcadia/help-response";
import { augmentUserMessageWithDiagramLinks } from "@/lib/mermaid/augment-message";
import { selectChatModel } from "@/lib/api/select-chat-model";
import { ChatRequestSchema } from "@/lib/schemas/chat";
import { ChatUIMessage, ChatAIActionEnum } from "@/types/ai";
import { tryArcadiaChatHelpShortcut } from "@/lib/api/arcadia-chat-help-shortcut";
import { respondWithShellHelpReflex, startShellHelpReflex } from "@/lib/api/subagent-help-reflex";
import { getHardSetSubagent } from "@/lib/llm/subagents/hard-set/registry";
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
  appendTopicExploreCustomSystemPrompt,
  wrapSystemPromptWithResponseLength,
} from "@/lib/api/chat-system-prompt";
import { appendIntrospectionMainChatSystemFragments } from "@/lib/api/introspection-system-prompt";
import { appendCurrentDate } from "@/lib/system-prompt/current-date";
import { resolveMemoryEnabledForExperience } from "@/lib/chat/chat-experience";
import { resolveChatStarterPromptByKey } from "@/lib/chat/chat-style-starters";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { runLLMChatStream } from "@/lib/api/run-llm-chat-stream";
import {
  prepareArcadiaMultitaskTurn,
  prepareRabbitHoleMultitaskTurn,
  type PrepareMultitaskTurnResult,
} from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import { RABBIT_HOLE_MAX_DISPATCHES_PER_TURN } from "@/lib/llm/subagents/orchestrator/constants";
import { createMultitaskTurnDeps } from "@/lib/llm/subagents/orchestrator/multitask-turn-deps";
import { withArcadiaOrchestratorTools } from "@/lib/llm/subagents/orchestrator/orchestrator-tools";
import { foldSystemNoticesForModel } from "@/lib/llm/subagents/threads/fold-system-notices";
import { buildPersonaInstructions } from "@/lib/personas/unified/prompt";
import { decidePersonaResponse } from "@/lib/personas/unified/response-gate";
import { receiptLabel, type PersonaSession } from "@/lib/personas/unified/session";
import { getPersonaStore, type PersonaStore } from "@/lib/personas/unified/store";
import { loadUserConnectorsProfile } from "@/lib/connectors/user-connectors-store";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";

// The stream still ends with the orchestrator's reply. The higher ceiling is for Arcadia subagent
// runs scheduled with `after()`, which share this route's budget — keep in step with
// SUBAGENT_RUN_MAX_DURATION_MS (lib/llm/subagents/threads/status.ts).
export const maxDuration = 300;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

/** Stream admission denials, in the gate's body shape so the client can map `code` to copy. */
const ADMISSION_DENIALS = {
  busy: [429, "thread_busy", "Thread is busy"],
  capacity: [429, "stream_limit", "Simultaneous stream limit reached"],
  not_found: [404, "thread_not_found", "Thread not found"],
} as const;

function admissionRejected(status: number, code: string, error: string): Response {
  return Response.json(
    { error, status, code },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 503 ? { "Retry-After": "30" } : {}),
      },
    }
  );
}

export async function POST(req: Request) {
  const requestStartedAt = performance.now();
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    logger.error("POST", "Invalid request body: malformed_json");

    return new Response(JSON.stringify({ error: "Invalid JSON", status: 400 }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parseResult = ChatRequestSchema.safeParse(body);

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
    coalescenceMode,
    experimentalKnowledgeCapsuleTitles,
    experience,
    chatStyle,
    strataPageId,
    messageSearch,
    knowledgeSearch,
    strataAssistantPersona,
    model: requestedModel,
    effort: requestedEffort,
    memory: requestedMemory,
    contextEffort,
    delphiDisplay,
    drawerDisplay,
    rabbitHoleSessionId,
    diagramNodeLinks,
    customSystemPromptOverride,
    multitaskSendTarget,
    personaSessionId,
  } = parseResult.data;

  /**
   * Authentication
   */
  const authGate = await requireLlmChatActor({ streamAdmission: "atomic" });

  if (authGate.error != null) {
    return authGate.error;
  }

  const { sbUserId, clerkUserId } = authGate.data!;
  let admission: Awaited<ReturnType<typeof acquireChatStreamLease>>;

  try {
    admission = await acquireChatStreamLease(sbUserId, id);
  } catch {
    return admissionRejected(503, "stream_admission_unavailable", "Stream admission unavailable");
  }
  if (!admission.ok) {
    const [status, code, error] = ADMISSION_DENIALS[admission.reason];

    return admissionRejected(status, code, error);
  }
  const release = admission.release;

  try {
    const message = incomingMessage as UIMessage;
    const messageForLlm = augmentUserMessageWithDiagramLinks(message, diagramNodeLinks);
    const memoryEnabled = resolveMemoryEnabledForExperience(experience, requestedMemory);

    // Zero Data Retention Policy is in regards to external LLMs, not Organic LLM at this time
    // If enabled, we only use LLMs that have ZDR compatibility
    const isZeroDataRetention = zeroDataRetention === true;

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

    const userMessageSave = saveChat({ chatId: id, messages: [message] })
      .then(() => {
        logger.log("POST", "User message saved optimistically");
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));

        logger.error("POST", `Failed to save user message: ${e.name}`);
      });

    const stream = createUIMessageStream<ChatUIMessage>({
      execute: async ({ writer }) => {
        // Transient status also works for persona turns that will be held without a reply.
        writer.write({
          type: "data-aiAction",
          data: { action: ChatAIActionEnum.Processing, message: "Gathering context" },
          transient: true,
        });
        // Measures server enqueue latency; client receipt also includes transport buffering.
        logger.log("timing", "First stream update enqueued", {
          chatId: id,
          timeToFirstUpdateMs: performance.now() - requestStartedAt,
        });

        // Model and persona are independent, so they load concurrently. The model resolves before
        // orchestration and tool compilation, which both need its ID.
        const setupStartedAt = performance.now();
        const resolveModel = async () => {
          const selection = await selectChatModel({
            requestedModel,
            draftText: getLastUserMessageText(message),
            experience,
            zeroDataRetention: isZeroDataRetention,
            clerkUserId,
            logger,
          });

          logger.log("timing", "Model resolution completed", {
            chatId: id,
            durationMs: performance.now() - setupStartedAt,
          });

          return selection;
        };
        // A unified persona that cannot be loaded (expired, switched off elsewhere) degrades to a
        // normal reply rather than failing the user's message. Never rejects.
        const loadPersona = async () => {
          let store: PersonaStore | null = null;
          let session: PersonaSession | null = null;

          if (personaSessionId) {
            try {
              store = await getPersonaStore();
              session = await store.load(sbUserId, personaSessionId);
            } catch (err) {
              logger.error("POST", "Persona session unavailable; replying without it", {
                err: err instanceof Error ? err.message : String(err),
              });
            }
          }

          logger.log("timing", "Persona loading completed", {
            chatId: id,
            requested: Boolean(personaSessionId),
            durationMs: performance.now() - setupStartedAt,
          });

          return { store, session };
        };
        const [
          { selectedModel, requestedModelId },
          { store: personaStore, session: personaSession },
        ] = await Promise.all([resolveModel(), loadPersona()]);

        logger.log("timing", "Model and persona setup completed", {
          chatId: id,
          durationMs: performance.now() - setupStartedAt,
        });

        // Not every message needs a reply. The gate decides; the receipt tells the user either way.
        if (personaSession && personaStore) {
          const userText = getLastUserMessageText(message);
          const hasImage = message.parts.some(
            (part) => part.type === "file" && part.mediaType.startsWith("image/")
          );
          const decision = await decidePersonaResponse({
            text: userText,
            hasImage,
            recent: personaSession.log,
            subject: personaSession.subject,
          });

          writer.write({
            type: "data-persona-receipt",
            data: {
              messageId: message.id ?? null,
              disposition: decision.respond ? "respond" : "hold",
              kind: decision.kind,
              label: receiptLabel(decision.respond, decision.kind),
            },
            transient: true,
          });
          logger.log("POST", `Persona gate ${decision.respond ? "respond" : "hold"}`, {
            kind: decision.kind,
            source: decision.source,
          });
          void personaStore
            .appendLog(sbUserId, personaSession.id, [
              {
                surface: "chat",
                role: "user",
                text: userText || (hasImage ? "(sent a photo)" : ""),
                held: !decision.respond,
              },
            ])
            .catch((err) =>
              logger.warn("POST", "Could not log persona turn", { err: String(err) })
            );

          if (!decision.respond) return;
        }

        // Identify the response before data parts can create a client-side message during replay.
        writer.write({ type: "start", messageId: assistantMessageId });

        // Arcadia & Rabbit Hole multitask: subagents run in their own threads after this response,
        // so the orchestrator frees CoreInput / Drawer as soon as its reply ends.
        let multitask: PrepareMultitaskTurnResult | null = null;
        let rabbitHoleActiveNodeId: string | null = null;
        let rabbitHoleRootNodeId: string | null = null;
        let rabbitHoleNodes: Record<string, RabbitHoleNode> | null = null;
        let orchestratorThreadId = id;
        let livePlanBudget: PlanBudgetSnapshot | null = null;
        const multitaskDeps = createMultitaskTurnDeps({
          ownerId: sbUserId,
          clerkUserId,
          route: "/api/chat",
        });
        const userConnectors =
          experience === "arcadia" || experience === "rabbit_hole"
            ? await loadUserConnectorsProfile(clerkUserId).catch(() => null)
            : null;

        if (experience === "arcadia" && !personaSession) {
          multitask = await prepareArcadiaMultitaskTurn({
            chatId: id,
            ownerId: sbUserId,
            userText: getLastUserMessageText(messageForLlm),
            sendTarget: multitaskSendTarget,
            modelId: selectedModel.id,
            zeroDataRetention: isZeroDataRetention,
            writer,
            deps: multitaskDeps,
            userConnectors,
          });
        } else if (experience === "rabbit_hole" && id) {
          if (rabbitHoleSessionId) {
            const { getSessionById } = await import("@/data/supabase/rabbitholes");
            const sessionRes = await getSessionById(rabbitHoleSessionId);

            if (sessionRes.data) {
              rabbitHoleActiveNodeId = sessionRes.data.activeNodeId ?? null;
              rabbitHoleRootNodeId = sessionRes.data.rootNodeId ?? null;
              rabbitHoleNodes = sessionRes.data.nodesById ?? null;
              orchestratorThreadId = sessionRes.data.chatThreadId ?? id;
            }
          }
          livePlanBudget = await getPlanBudgetForUser({
            clerkUserId,
            ownerId: sbUserId,
          }).catch(() => null);
          multitask = await prepareRabbitHoleMultitaskTurn({
            chatId: orchestratorThreadId,
            ownerId: sbUserId,
            userText: getLastUserMessageText(messageForLlm),
            sendTarget: multitaskSendTarget,
            modelId: selectedModel.id,
            zeroDataRetention: isZeroDataRetention,
            writer,
            deps: multitaskDeps,
            planBudget: livePlanBudget,
            maxDispatchesPerTurn: RABBIT_HOLE_MAX_DISPATCHES_PER_TURN,
            userConnectors,
          });
        }

        // Hard-set subagent shell: Jev decides help reflex vs. a normal turn, alongside context load.
        const shellAgent = getHardSetSubagent(multitask?.hardSetAgentId);
        const shellReflex = shellAgent
          ? startShellHelpReflex({
              agent: shellAgent,
              message: messageForLlm,
              ownerId: sbUserId,
              route: "/api/chat",
            })
          : null;

        const loadTurnContext =
          experience === "arcadia"
            ? () =>
                loadArcadiaChatTurnContext({
                  logger,
                  chatId: id,
                  message: messageForLlm,
                  memoryEnabled,
                  contextEffort,
                })
            : () =>
                loadMainChatTurnContext({
                  logger,
                  chatId: id,
                  message: messageForLlm,
                  memoryEnabled,
                  experience,
                });

        let {
          validatedMessages,
          systemPromptForRequest: afterContext,
          tokenBreakdown,
          packedMessageCount,
          totalThreadMessages,
          scheduleBackgroundCondensation,
          memoriesInjected,
          memoryContext,
          activatedMemories,
        } = await loadTurnContext();

        validatedMessages = await stampTurnWithActivatedMemories({
          chatId: id,
          validatedMessages,
          savedUserMessage: message,
          activatedMemories,
          userMessageSave,
        });

        if (experience === "arcadia" && scheduleBackgroundCondensation) {
          scheduleArcadiaContextCondensation({
            chatId: id,
            modelId: selectedModel.id,
          });
        }

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

        // Noesis authored-spark override: when a spark drives a topic_explore thread.
        systemPromptForRequest = appendTopicExploreCustomSystemPrompt({
          systemPromptForRequest,
          experience,
          customSystemPromptOverride,
        });
        // The orchestrator's board, worktable, and routing change every turn: send them after the
        // conversation (see withTurnContext) so the system prompt stays cacheable. A subagent's
        // fragments are its fixed identity and stay in the system prompt.
        const turnContext =
          multitask?.role === "orchestrator" ? multitask.systemFragments : ([] as string[]);

        if (multitask && multitask.role !== "orchestrator") {
          for (const fragment of multitask.systemFragments) {
            systemPromptForRequest = `${systemPromptForRequest}\n\n${fragment}`;
          }
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

        if (shellAgent && shellReflex) {
          if ((await shellReflex).reflex) {
            await respondWithShellHelpReflex({
              agent: shellAgent,
              assistantMessageId,
              validatedMessages,
              chatId: id,
              sbUserId,
              writer,
              logger,
            });

            return;
          }
        } else if (
          !personaSession &&
          (await tryArcadiaChatHelpShortcut({
            experience,
            message,
            validatedMessages,
            assistantMessageId,
            chatId: id,
            sbUserId,
            writer,
            logger,
          }))
        ) {
          return;
        }

        writer.write({
          type: "data-notification",
          data: { message: `Using ${selectedModel.name}`, level: "info" },
          transient: true,
        });

        const messages = await convertToModelMessages(
          foldSystemNoticesForModel(expandActivatedMemoriesForModel(validatedMessages))
        );
        const initialMessageCount = validatedMessages.length;

        const orchestratorToolsConfig = {
          multitask,
          orchestratorThreadId,
          deps: multitaskDeps,
          modelId: selectedModel.id,
          zeroDataRetention: isZeroDataRetention,
          autonomous: false,
          currentUserMessage: { id: message.id, text: getLastUserMessageText(messageForLlm) },
          writer,
          rabbitHoleNodes,
          rabbitHoleActiveNodeId,
          rabbitHoleRootNodeId,
          userConnectors,
          planBudget: livePlanBudget,
          maxDispatchesPerTurn:
            experience === "rabbit_hole" ? RABBIT_HOLE_MAX_DISPATCHES_PER_TURN : undefined,
          alwaysIncludeReadSubagentThread: experience === "rabbit_hole",
        };

        const compiledTools = await compileChatTools({
          useSearch: shellAgent?.tools.webSearch ?? parseResult.data.webSearch ?? false,
          useResearch: shellAgent?.tools.research ?? false,
          useChronos: shellAgent?.tools.chronos ?? false,
          useErgonAgent: shellAgent?.tools.ergon ?? false,
          researchModelId: selectedModel.id,
          researchGenerationContext: { messages, system: systemPromptForRequest },
          useMemory: shellAgent?.tools.memory ?? parseResult.data.memory ?? false,
          useGetMoreMessages: shellAgent?.tools.chatHistory ?? messageSearch ?? true,
          useKnowledgeSearch: Boolean(knowledgeSearch) && experience === "strata_page",
          experience,
          chatStyle,
          chatId: id,
          initialMessageCount,
          sbUserId,
          writer,
          rabbitHoleSessionId,
          rabbitHoleActiveNodeId,
          rabbitHoleRootNodeId,
          rabbitHoleNodes,
          multitaskOrchestrator: experience === "rabbit_hole" ? orchestratorToolsConfig : undefined,
        });
        const { tools, toolInstructions } = withArcadiaOrchestratorTools(
          compiledTools,
          orchestratorToolsConfig
        );

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
          drawerDisplay,
          arcadiaStarterPriming,
        });
        if (personaSession) {
          systemPromptForRequest += buildPersonaInstructions(personaSession, { surface: "chat" });
        }

        writer.write({
          type: "data-aiAction",
          data: { action: ChatAIActionEnum.Processing, message: "Thinking..." },
          transient: true,
        });

        const systemPromptWithLength = appendCurrentDate(
          wrapSystemPromptWithResponseLength(systemPromptForRequest, {
            experience,
            delphiDisplay,
          })
        );

        const inputTokenEstimate = estimateLlmInputTokens({
          systemPrompt: [systemPromptWithLength, ...turnContext].join("\n\n"),
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

        const contextBudget = await buildBudgetFromAssembledTurn({
          modelId: requestedModelId,
          resolvedModelId: selectedModel.id,
          draftMessage: message,
          validatedMessages,
          contextSystemPrompt: afterContext,
          finalSystemPrompt: [systemPromptWithLength, ...turnContext].join("\n\n"),
          toolInstructions,
          activeToolNames: toolNames,
          tokenBreakdown,
          packedMessageCount,
          totalThreadMessages,
          contextMessageLimit:
            experience === "arcadia" ? undefined : getContextMessageLimit(experience),
          memoriesInjected,
          memoryContext,
          recordLastTurn: true,
        });

        // Initial estimate; runLLMChatStream publishes updated usage after steps and completion.
        writer.write({
          type: "data-context-budget",
          id: "context-budget",
          data: contextBudget,
        });

        await runLLMChatStream({
          writer,
          contextBudget,
          logger,
          chatId: id,
          sbUserId,
          clerkUserId,
          assistantMessageId,
          selectedModel,
          effort: requestedEffort,
          messages,
          systemPromptWithLength,
          turnContext,
          tools,
          hasTools,
          maxSteps,
          isZeroDataRetention,
          coalescenceMode: coalescenceMode === true,
          experimentalKnowledgeCapsuleTitles: experimentalKnowledgeCapsuleTitles === true,
          memoryEnabled,
          experience,
          userMessage: message,
          threadHasTitlePromise,
          onAssistantMessage:
            personaSession && personaStore
              ? (text) => {
                  void personaStore
                    .appendLog(sbUserId, personaSession.id, [
                      { surface: "chat", role: "assistant", text },
                    ])
                    .catch(() => undefined);
                }
              : undefined,
        });
      },
    });

    return createUIMessageStreamResponse({
      // Kick the thread's send queue only after the lease is gone, or dispatch sees it as busy.
      stream: releaseAfterStream(
        stream,
        async () => {
          await release();
          const { kickDispatchAfterStream } = await import("@/lib/message-queue/dispatch");

          await kickDispatchAfterStream({ ownerId: sbUserId, clerkUserId, threadId: id });
        },
        (completion) => after(() => completion)
      ),
      async consumeSseStream({ stream: sseStream }) {
        await consumeChatSseStream({ stream: sseStream, chatId: id, logger });
      },
    });
  } catch (error) {
    await release();
    throw error;
  }
}
