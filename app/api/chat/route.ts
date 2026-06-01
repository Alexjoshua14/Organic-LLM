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
import { getThreadHasTitle } from "@/data/supabase/chat";
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
import { loadMainChatTurnContext } from "@/lib/api/chat-turn-context";
import { computeMainChatMaxSteps } from "@/lib/api/chat-max-steps";
import {
  appendMainChatPostToolSystemFragments,
  appendStrataMainChatSystemFragments,
  wrapSystemPromptWithResponseLength,
} from "@/lib/api/chat-system-prompt";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { runLLMChatStream } from "@/lib/api/run-llm-chat-stream";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const body = await req.json();

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
    experience,
    chatStyle,
    strataPageId,
    messageSearch,
    knowledgeSearch,
    strataAssistantPersona,
    model: requestedModel,
    memory: memoryEnabled,
  } = parseResult.data;
  const message = incomingMessage as UIMessage;

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

  logger.log(
    "POST",
    `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
  );

  const authGate = await requireLlmChatActor();

  if (authGate.error != null) {
    return authGate.error;
  }

  const { sbUserId } = authGate.data!;

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
      writer.write({
        type: "data-aiAction",
        data: {
          action: ChatAIActionEnum.Processing,
          message: "Gathering context",
        },
        transient: true,
      });

      const { validatedMessages, systemPromptForRequest: afterContext } =
        await loadMainChatTurnContext({
          logger,
          chatId: id,
          message,
          memoryEnabled,
          experience,
        });

      let systemPromptForRequest = await appendStrataMainChatSystemFragments({
        systemPromptForRequest: afterContext,
        experience,
        strataPageId,
        sbUserId,
        strataAssistantPersona,
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

      systemPromptForRequest = appendMainChatPostToolSystemFragments({
        systemPromptForRequest,
        hasTools,
        toolInstructions,
        speechFriendly: parseResult.data.speechFriendly,
        experience,
      });

      writer.write({
        type: "data-aiAction",
        data: { action: ChatAIActionEnum.Processing, message: "Thinking..." },
        transient: true,
      });

      const systemPromptWithLength = wrapSystemPromptWithResponseLength(systemPromptForRequest);

      runLLMChatStream({
        writer,
        logger,
        chatId: id,
        sbUserId,
        assistantMessageId,
        selectedModel,
        messages,
        systemPromptWithLength,
        tools,
        hasTools,
        maxSteps,
        isZeroDataRetention,
        memoryEnabled,
        experience,
        userMessage: message,
        threadHasTitlePromise,
      });
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
