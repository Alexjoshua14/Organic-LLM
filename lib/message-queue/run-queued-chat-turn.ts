import "server-only";

import type {
  MessageSendQueuePayload,
  MessageSendQueueRow,
} from "@/lib/schemas/message-send-queue";

import { randomUUID } from "crypto";

import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  consumeStream,
  type UIMessage,
} from "ai";

import { getThreadHasTitle } from "@/data/supabase/chat";
import { isAdminUser } from "@/data/supabase/profiles";
import { resolveChatModel } from "@/lib/api/resolve-chat-model";
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
import { runLLMChatStream } from "@/lib/api/run-llm-chat-stream";
import { saveChat } from "@/lib/chat/chat-store";
import { stampTurnWithActivatedMemories } from "@/lib/chat/stamp-activated-memories";
import { expandActivatedMemoriesForModel } from "@/lib/memory/activated-thread-memories";
import { resolveMemoryEnabledForExperience } from "@/lib/chat/chat-experience";
import { getLastUserMessageText } from "@/lib/arcadia/help-response";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { getChatModel } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { AUTO_CHAT_MODEL_ID, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { sendTargetFromQueueAgentId } from "@/lib/schemas/arcadia-multitask-send-target";
import { appendCurrentDate } from "@/lib/system-prompt/current-date";
import { ChatAIActionEnum, type ChatUIMessage } from "@/types/ai";
import {
  prepareArcadiaMultitaskTurn,
  type PrepareMultitaskTurnResult,
} from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";
import { createMultitaskTurnDeps } from "@/lib/llm/subagents/orchestrator/multitask-turn-deps";
import { withReadSubagentThreadTool } from "@/lib/llm/subagents/orchestrator/read-subagent-thread-tool";
import { foldSystemNoticesForModel } from "@/lib/llm/subagents/threads/fold-system-notices";

const logger = createLogger("lib/message-queue/run-queued-chat-turn.ts");

/**
 * Runs one queued user message through the existing main-chat LLM path
 * (context → tools → runLLMChatStream) and consumes the stream server-side.
 * Does not open a client SSE connection — suitable for background dispatch.
 */
export async function runQueuedChatTurn(args: {
  item: MessageSendQueueRow;
  sbUserId: string;
  clerkUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { item, sbUserId, clerkUserId } = args;
  if (item.payload?.subagentRun) {
    const { runQueuedSubagentTurn } = await import("@/lib/message-queue/run-queued-subagent-turn");
    return runQueuedSubagentTurn(item, sbUserId);
  }
  const chatId = item.thread_id;
  const payload: MessageSendQueuePayload =
    item.payload && typeof item.payload === "object" ? item.payload : {};
  const experience = payload.experience;
  const memoryEnabled = resolveMemoryEnabledForExperience(experience, payload.memory);

  const heartbeatMessageId = item.payload?.heartbeatMessageId;
  const isHeartbeat = typeof heartbeatMessageId === "string";
  const userMessage: UIMessage = {
    id: isHeartbeat ? heartbeatMessageId : randomUUID(),
    role: isHeartbeat ? "system" : "user",
    parts: [{ type: "text", text: isHeartbeat ? "Review the latest subagent update. Read the relevant subagent thread if needed, then give the user a concise update and any next steps. This is an automatic heartbeat, not a new assignment." : item.body }],
  };

  let selectedModel = payload.model ? getChatModel(payload.model) : DEFAULT_CHAT_MODEL;
  const requestedModelId = selectedModel.id;

  if (selectedModel.id === AUTO_CHAT_MODEL_ID) {
    selectedModel = resolveChatModel({
      modelId: selectedModel.id,
      draftText: getLastUserMessageText(userMessage),
      experience,
      zeroDataRetention: payload.zeroDataRetention === true,
    });
  }

  const canonicalModel = ChatModels.find((m) => m.id === selectedModel.id);

  if (canonicalModel?.adminOnly) {
    const isAdmin = await isAdminUser(clerkUserId);

    if (!isAdmin) {
      selectedModel = DEFAULT_CHAT_MODEL;
    }
  }

  const assistantMessageId = randomUUID();
  const threadHasTitlePromise = getThreadHasTitle(chatId);

  const userMessageSave = isHeartbeat
    ? Promise.resolve()
    : saveChat({
        chatId,
        messages: [userMessage],
        useAdminForSave: true,
        ownerId: sbUserId,
      }).catch((err) => {
        logger.error("runQueuedChatTurn", "Failed to save user message", {
          err: err instanceof Error ? err.message : String(err),
        });
      });

  await userMessageSave;

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-aiAction",
        data: { action: ChatAIActionEnum.Processing, message: "Gathering context" },
        transient: true,
      });

      // Arcadia multitask: same path as /api/chat — subagents run in their own threads via
      // `after()` (nested inside the queue route's `after` drain).
      let multitask: PrepareMultitaskTurnResult | null = null;

      if (experience === "arcadia") {
        multitask = await prepareArcadiaMultitaskTurn({
          chatId,
          ownerId: sbUserId,
          userText: isHeartbeat ? "" : getLastUserMessageText(userMessage),
          sendTarget: sendTargetFromQueueAgentId(item.target_agent_id),
          modelId: selectedModel.id,
          zeroDataRetention: payload.zeroDataRetention === true,
          writer,
          deps: createMultitaskTurnDeps({ ownerId: sbUserId, clerkUserId, route: "/api/chat/queue" }),
        });
      }

      const loadTurnContext =
        experience === "arcadia"
          ? () =>
              loadArcadiaChatTurnContext({
                logger,
                chatId,
                message: userMessage,
                memoryEnabled,
              })
          : () =>
              loadMainChatTurnContext({
                logger,
                chatId,
                message: userMessage,
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
        activatedMemories,
      } = await loadTurnContext();

      if (!isHeartbeat) {
        validatedMessages = await stampTurnWithActivatedMemories({
          chatId,
          validatedMessages,
          savedUserMessage: userMessage,
          activatedMemories,
          userMessageSave,
          ownerId: sbUserId,
        });
      }

      if (experience === "arcadia" && scheduleBackgroundCondensation) {
        scheduleArcadiaContextCondensation({
          chatId,
          modelId: selectedModel.id,
        });
      }

      let systemPromptForRequest = await appendStrataMainChatSystemFragments({
        systemPromptForRequest: afterContext,
        experience,
        strataPageId: undefined,
        sbUserId,
        strataAssistantPersona: undefined,
      });

      systemPromptForRequest = await appendIntrospectionMainChatSystemFragments({
        systemPromptForRequest,
        experience,
        chatId,
        sbUserId,
      });

      for (const fragment of multitask?.systemFragments ?? []) {
        systemPromptForRequest = `${systemPromptForRequest}\n\n${fragment}`;
      }

      const messages = await convertToModelMessages(
        foldSystemNoticesForModel(expandActivatedMemoriesForModel(validatedMessages))
      );
      const initialMessageCount = validatedMessages.length;

      const compiledTools = await compileChatTools({
        useSearch: payload.webSearch ?? false,
        useMemory: payload.memory ?? false,
        useGetMoreMessages: payload.messageSearch ?? true,
        useKnowledgeSearch: false,
        experience,
        chatId,
        initialMessageCount,
        sbUserId,
        writer,
      });
      const { tools, toolInstructions } =
        multitask?.role === "orchestrator" && multitask.hasSubagentThreads
          ? withReadSubagentThreadTool(compiledTools, {
              orchestratorThreadId: chatId,
              deps: createMultitaskTurnDeps({ ownerId: sbUserId, clerkUserId, route: "/api/chat/queue" }),
            })
          : compiledTools;

      const toolNames = Object.keys(tools);
      const hasTools = toolNames.length > 0;
      const maxSteps = computeMainChatMaxSteps({ experience, hasTools });

      systemPromptForRequest = appendMainChatPostToolSystemFragments({
        systemPromptForRequest,
        hasTools,
        toolInstructions,
        speechFriendly: payload.speechFriendly,
        experience,
      });

      const systemPromptWithLength = appendCurrentDate(
        wrapSystemPromptWithResponseLength(systemPromptForRequest, { experience })
      );

      const inputTokenEstimate = estimateLlmInputTokens({
        systemPrompt: systemPromptWithLength,
        toolInstructions,
        messages: validatedMessages,
      });

      try {
        assertLlmInputWithinHardCap(inputTokenEstimate);
      } catch (capError) {
        logger.error("runQueuedChatTurn", "LLM input hard cap exceeded", {
          err: capError instanceof Error ? capError.message : String(capError),
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

      await buildBudgetFromAssembledTurn({
        modelId: requestedModelId,
        resolvedModelId: selectedModel.id,
        draftMessage: userMessage,
        validatedMessages,
        contextSystemPrompt: afterContext,
        finalSystemPrompt: systemPromptWithLength,
        toolInstructions,
        activeToolNames: toolNames,
        tokenBreakdown,
        packedMessageCount,
        totalThreadMessages,
        contextMessageLimit:
          experience === "arcadia" ? undefined : getContextMessageLimit(experience),
        memoriesInjected,
        recordLastTurn: true,
      });

      writer.write({
        type: "data-aiAction",
        data: { action: ChatAIActionEnum.Processing, message: "Thinking..." },
        transient: true,
      });

      await runLLMChatStream({
        writer,
        logger,
        chatId,
        sbUserId,
        clerkUserId,
        assistantMessageId,
        selectedModel,
        effort: payload.effort,
        messages,
        systemPromptWithLength,
        tools,
        hasTools,
        maxSteps,
        isZeroDataRetention: payload.zeroDataRetention === true,
        coalescenceMode: false,
        memoryEnabled,
        experience,
        userMessage,
        threadHasTitlePromise,
      });

    },
  });

  try {
    // Drain via the same response helper as /api/chat so execute() runs and
    // runLLMChatStream persists the assistant turn. Mark the thread busy with a
    // queue sentinel so concurrent dispatch sees active_stream_id until onFinish clears it.
    const response = createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        await saveChat({
          chatId,
          activeStreamId: `queue:${item.id}`,
          useAdminForSave: true,
          ownerId: sbUserId,
        });
        await consumeStream({ stream: sseStream });
      },
    });

    await response.text();

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    logger.error("runQueuedChatTurn", "Stream consume failed", { err: message });

    await saveChat({
      chatId,
      activeStreamId: null,
      useAdminForSave: true,
      ownerId: sbUserId,
    }).catch(() => undefined);

    return { ok: false, error: message };
  }
}
