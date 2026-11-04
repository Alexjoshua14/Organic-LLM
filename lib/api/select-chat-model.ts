import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { Logger } from "@/lib/logger";
import type { ChatModel } from "@/lib/schemas/chat";

import { isAdminUser } from "@/data/supabase/profiles";
import { resolveChatModel } from "@/lib/api/resolve-chat-model";
import { getChatModel } from "@/lib/llm/helpers";
import { AUTO_CHAT_MODEL_ID, ChatModels, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";

/** Select the turn's model, including Auto routing and admin-only model access. */
export async function selectChatModel({
  requestedModel,
  draftText,
  experience,
  zeroDataRetention,
  clerkUserId,
  logger,
}: {
  requestedModel?: ChatModel;
  draftText: string;
  experience?: ChatExperience;
  zeroDataRetention: boolean;
  clerkUserId: string;
  logger: Logger;
}) {
  let selectedModel = requestedModel ? getChatModel(requestedModel) : DEFAULT_CHAT_MODEL;
  const requestedModelId = selectedModel.id;

  if (selectedModel.id === AUTO_CHAT_MODEL_ID) {
    selectedModel = resolveChatModel({
      modelId: selectedModel.id,
      draftText,
      experience,
      zeroDataRetention,
    });
    logger.log("POST", `Model selection branch: auto_resolved -> ${selectedModel.id}`);
  } else {
    logger.log("POST", `Model selection explicit -> ${selectedModel.id}`);
  }
  // Admin-only models: check the canonical registry entry (the client payload isn't trusted
  // to carry the adminOnly flag) and fall back to the default model for non-admins.
  const canonicalModel = ChatModels.find((m) => m.id === selectedModel.id);

  if (canonicalModel?.adminOnly) {
    const isAdmin = await isAdminUser(clerkUserId);

    if (!isAdmin) {
      logger.error(
        "POST",
        `Non-admin requested admin-only model ${selectedModel.id}; falling back to ${DEFAULT_CHAT_MODEL.id}`
      );
      selectedModel = DEFAULT_CHAT_MODEL;
    }
  }

  logger.log(
    "POST",
    `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
  );

  return { selectedModel, requestedModelId };
}
