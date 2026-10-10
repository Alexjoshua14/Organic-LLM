import type { UIMessage, UIMessageStreamWriter } from "ai";
import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";
import type { HelpReflexDecision } from "@/lib/llm/subagents/hard-set/reflex";
import type { Logger } from "@/lib/logger";
import type { ChatUIMessage } from "@/types/ai";

import { generateId } from "ai";

import { getLastUserMessageText } from "@/lib/arcadia/help-response";
import { saveChat } from "@/lib/chat/chat-store";
import { classifyHelpReflex } from "@/lib/llm/subagents/hard-set/reflex";
import { buildHelpReflexMessage } from "@/lib/llm/subagents/hard-set/shell";
import { recordGatewayCallUsage } from "@/lib/usage/record-gateway-call";

/**
 * Start the Jev help-reflex check for a shell turn. Call it early — it runs alongside context
 * loading. Messages with attachments always pass through. Records Jev usage when it ran.
 */
export function startShellHelpReflex(args: {
  agent: HardSetSubagent;
  message: UIMessage;
  ownerId: string;
  route: string;
}): Promise<HelpReflexDecision> {
  if (args.message.parts.some((part) => part.type !== "text")) {
    return Promise.resolve({ reflex: false, reason: "has-attachments" });
  }

  return classifyHelpReflex({
    text: getLastUserMessageText(args.message),
    agent: args.agent,
    ownerId: args.ownerId,
  }).then(async (decision) => {
    if (decision.modelId) {
      await recordGatewayCallUsage({
        ownerId: args.ownerId,
        modelId: decision.modelId,
        usage: decision.usage,
        providerMetadata: decision.providerMetadata,
        operation: "subagent_reflex",
        route: args.route,
      });
    }

    return decision;
  });
}

/** Stream and save the subagent's help menu as this turn's reply — no model call. */
export async function respondWithShellHelpReflex(args: {
  agent: HardSetSubagent;
  assistantMessageId: string;
  validatedMessages: UIMessage[];
  chatId: string;
  sbUserId: string;
  writer: UIMessageStreamWriter<ChatUIMessage>;
  logger: Logger;
}): Promise<void> {
  const reply = buildHelpReflexMessage(args.agent, args.assistantMessageId);
  const textPartId = generateId();

  args.writer.write({ type: "text-start", id: textPartId });
  args.writer.write({ type: "text-delta", id: textPartId, delta: args.agent.helpMenu });
  args.writer.write({ type: "text-end", id: textPartId });

  const saveResult = await saveChat({
    chatId: args.chatId,
    messages: [...args.validatedMessages, reply],
    activeStreamId: null,
    useAdminForSave: true,
    ownerId: args.sbUserId,
  });

  if (saveResult.error) {
    args.logger.error("POST", "Failed to save subagent help reflex", { error: saveResult.error });
  }
}
