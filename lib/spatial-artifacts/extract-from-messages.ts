import type { UIMessage } from "ai";

import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from "ai";

import { spatialArtifactId } from "./artifact-id";

import {
  extractGenUIBlockFromToolOutput,
  safeParseGenUIBlock,
  type GenUIBlock,
  type GenUIBlockType,
} from "@/lib/schemas/gen-ui";
import { RENDER_GEN_UI_TOOL_NAME } from "@/lib/llm/gen-ui-tool";

export type ExtractedGenUIArtifact = {
  id: string;
  threadId: string;
  messageId: string;
  toolCallId: string;
  partIndex: number;
  block: GenUIBlock;
  blockType: GenUIBlockType;
};

export function extractGenUIArtifactsFromMessages(
  messages: UIMessage[],
  threadId: string
): ExtractedGenUIArtifact[] {
  const results: ExtractedGenUIArtifact[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    message.parts.forEach((part, partIndex) => {
      if (!isToolOrDynamicToolUIPart(part)) return;
      if (getToolOrDynamicToolName(part) !== RENDER_GEN_UI_TOOL_NAME) return;
      if (part.state !== "output-available") return;

      const raw = extractGenUIBlockFromToolOutput(part.output);
      const parsed = safeParseGenUIBlock(raw);

      if (!parsed.ok) return;

      const toolCallId = part.toolCallId ?? "";

      results.push({
        id: spatialArtifactId({ threadId, toolCallId, messageId: message.id, partIndex }),
        threadId,
        messageId: message.id,
        toolCallId,
        partIndex,
        block: parsed.block,
        blockType: parsed.block.type,
      });
    });
  }

  return results;
}
