import type { ChatExperience } from "@/lib/chat/chat-experience";

import {
  classifyTaskTier,
  chatModelForGatewayId,
  tierToGatewayModelId,
} from "@/lib/llm/auto-model-router";
import {
  AUTO_CHAT_MODEL_ID,
  AUTO_RESOLVED_SONNET_MODEL_ID,
  type ChatModel,
  type ChatModelId,
  type GatewayModelId,
} from "@/lib/schemas/chat";

export type ResolveChatModelIdParams = {
  modelId: string;
  draftText?: string;
  experience?: ChatExperience;
  zeroDataRetention?: boolean;
};

/**
 * Resolves Auto to the concrete gateway model id the chat route would select.
 * Explicit model ids pass through unchanged.
 */
export function resolveChatModelId(params: ResolveChatModelIdParams): ChatModelId {
  const { modelId, draftText = "", experience, zeroDataRetention = false } = params;

  if (modelId !== AUTO_CHAT_MODEL_ID) {
    return modelId as ChatModelId;
  }

  if (experience === "delphi") {
    const tier = classifyTaskTier(draftText);
    const gatewayId = tierToGatewayModelId(tier, zeroDataRetention);

    return chatModelForGatewayId(gatewayId).id;
  }

  return AUTO_RESOLVED_SONNET_MODEL_ID;
}

/** Same as {@link resolveChatModelId}, but returns the registry {@link ChatModel} row. */
export function resolveChatModel(params: ResolveChatModelIdParams): ChatModel {
  return chatModelForGatewayId(resolveChatModelId(params) as GatewayModelId);
}
