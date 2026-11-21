import {
  JEV_STAGE_MAX_CONTEXT_TOKENS,
  JEV_STAGE_MAX_OUTPUT_TOKENS_HARD,
  JEV_STAGE_RESPOND_INPUT_BUDGET_USD,
  JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD,
} from "./constants";

import { getModelCost } from "@/lib/rate-limit/llm-cost";

/** Rough chars-per-token for packing recent messages into a dollar budget. */
const CHARS_PER_TOKEN = 4;

export function maxInputTokensForBudget(
  modelId: string,
  budgetUsd = JEV_STAGE_RESPOND_INPUT_BUDGET_USD
): number {
  const rate = getModelCost(modelId).inputPerMillion;

  if (rate <= 0) return JEV_STAGE_MAX_CONTEXT_TOKENS;
  const fromBudget = Math.floor((budgetUsd / rate) * 1_000_000);

  return Math.max(256, Math.min(JEV_STAGE_MAX_CONTEXT_TOKENS, fromBudget));
}

export function maxOutputTokensForBudget(
  modelId: string,
  budgetUsd = JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD
): number {
  const rate = getModelCost(modelId).outputPerMillion;

  if (rate <= 0) return JEV_STAGE_MAX_OUTPUT_TOKENS_HARD;
  const fromBudget = Math.floor((budgetUsd / rate) * 1_000_000);

  return Math.max(64, Math.min(JEV_STAGE_MAX_OUTPUT_TOKENS_HARD, fromBudget));
}

export type PackableMessage = { role: string; text: string };

/**
 * Newest-first packing of messages until the estimated token cost would exceed the input budget.
 * Returns messages oldest-first for the model prompt.
 */
export function packMessagesForInputBudget(
  messages: ReadonlyArray<PackableMessage>,
  modelId: string,
  budgetUsd = JEV_STAGE_RESPOND_INPUT_BUDGET_USD
): { messages: PackableMessage[]; estimatedTokens: number; truncated: boolean } {
  const maxTokens = maxInputTokensForBudget(modelId, budgetUsd);
  const picked: PackableMessage[] = [];
  let tokens = 0;
  let truncated = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    const estimate = Math.max(1, Math.ceil(message.text.length / CHARS_PER_TOKEN));

    if (tokens + estimate > maxTokens) {
      truncated = true;
      break;
    }
    picked.push(message);
    tokens += estimate;
  }

  return { messages: picked.reverse(), estimatedTokens: tokens, truncated };
}

export function estimateOutputCostUsd(modelId: string, outputTokens: number): number {
  const rate = getModelCost(modelId).outputPerMillion;

  return (outputTokens / 1_000_000) * rate;
}

export class RespondOutputBudgetExceededError extends Error {
  constructor(
    public modelId: string,
    public outputTokens: number,
    public costUsd: number,
    public budgetUsd: number
  ) {
    super(
      `Respond hit the $${budgetUsd.toFixed(2)} output budget (${outputTokens} tokens ≈ $${costUsd.toFixed(4)} on ${modelId}).`
    );
    this.name = "RespondOutputBudgetExceededError";
  }
}
