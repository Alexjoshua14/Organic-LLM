import type { UIMessage } from "ai";

import { ChatModels } from "@/lib/schemas/chat";

type MessageWithModel = UIMessage & {
  model?: string;
};

export function getMessageModelId(message: UIMessage): string | null {
  const model = (message as MessageWithModel).model;

  return typeof model === "string" && model.trim() !== "" ? model.trim() : null;
}

export function getModelDisplayName(modelId: string | null | undefined): string | null {
  if (!modelId) return null;

  return ChatModels.find((model) => model.id === modelId)?.name ?? modelId;
}

export function getAssistantModelSummary(messages: UIMessage[]): {
  modelId: string | null;
  label: string | null;
  shouldUseThreadBadge: boolean;
} {
  const assistantModelIds = messages
    .filter((message) => message.role === "assistant")
    .map(getMessageModelId)
    .filter((modelId): modelId is string => modelId !== null);

  if (assistantModelIds.length === 0) {
    return { modelId: null, label: null, shouldUseThreadBadge: false };
  }

  const counts = new Map<string, number>();

  assistantModelIds.forEach((modelId) => {
    counts.set(modelId, (counts.get(modelId) ?? 0) + 1);
  });

  const [dominantModelId, dominantCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominanceRatio = dominantCount / assistantModelIds.length;
  const shouldUseThreadBadge = counts.size === 1 || dominanceRatio >= 0.75;

  return {
    modelId: dominantModelId,
    label: getModelDisplayName(dominantModelId),
    shouldUseThreadBadge,
  };
}
