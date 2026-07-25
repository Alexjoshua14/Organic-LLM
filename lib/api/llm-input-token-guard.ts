import type { UIMessage } from "ai";

import {
  estimateTokenCountSync,
  getMessageTextForTokenEstimate,
} from "@/lib/chat/context-budget";
import { HARD_MAX_LLM_INPUT_TOKENS } from "@/lib/chat/arcadia-token-context";

export type LlmInputTokenEstimate = {
  totalTokens: number;
  systemTokens: number;
  toolTokens: number;
  messageTokens: number;
  hardCapTokens: number;
};

export function estimateLlmInputTokens(params: {
  systemPrompt: string;
  toolInstructions?: string;
  messages: UIMessage[];
}): LlmInputTokenEstimate {
  const systemTokens = estimateTokenCountSync(params.systemPrompt);
  const toolTokens = estimateTokenCountSync(params.toolInstructions ?? "");
  const messageTokens = params.messages.reduce((total, message) => {
    const text = getMessageTextForTokenEstimate(message);

    return total + (text ? estimateTokenCountSync(text) : 0);
  }, 0);

  return {
    totalTokens: systemTokens + toolTokens + messageTokens,
    systemTokens,
    toolTokens,
    messageTokens,
    hardCapTokens: HARD_MAX_LLM_INPUT_TOKENS,
  };
}

export function assertLlmInputWithinHardCap(estimate: LlmInputTokenEstimate): void {
  if (estimate.totalTokens <= estimate.hardCapTokens) {
    return;
  }

  throw new Error(
    `LLM input exceeds hard cap: ${estimate.totalTokens.toLocaleString()} tokens ` +
      `(limit ${estimate.hardCapTokens.toLocaleString()}). ` +
      `system=${estimate.systemTokens.toLocaleString()}, ` +
      `tools=${estimate.toolTokens.toLocaleString()}, ` +
      `messages=${estimate.messageTokens.toLocaleString()}`
  );
}
