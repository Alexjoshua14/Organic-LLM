/**
 * Model cost table and cost computation for LLM rate limiting.
 * Prices in USD per million tokens (input / output). Update from provider pricing pages as needed.
 */

export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

/** Input and output cost per million tokens (USD). */
export type ModelCost = {
  inputPerMillion: number;
  outputPerMillion: number;
};

/** Default cost when model is unknown (conservative: ~GPT-5 Mini). */
const DEFAULT_COST: ModelCost = {
  inputPerMillion: 0.25,
  outputPerMillion: 2.0,
};

/**
 * Cost per million tokens (USD). Sourced from provider pricing; update periodically.
 * Keys match model ids from lib/schemas/chat.ts (e.g. openai/gpt-5.4-mini).
 */
const MODEL_COSTS: Record<string, ModelCost> = {
  "openai/gpt-5.2": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  "openai/gpt-5": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  "openai/gpt-5.4-mini": { inputPerMillion: 0.25, outputPerMillion: 2.0 },
  "openai/gpt-5.4-nano": { inputPerMillion: 0.05, outputPerMillion: 0.4 },
  "openai/gpt-5.5": { inputPerMillion: 5.0, outputPerMillion: 30.0 },
  "openai/gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  "openai/gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "openai/gpt-4-turbo": { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  "google/gemini-3-pro-preview": {
    inputPerMillion: 1.25,
    outputPerMillion: 10.0,
  },
  "google/gemini-3-flash": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "google/gemini-2.5-flash-lite": {
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
  },
  "anthropic/claude-opus-4-6": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "anthropic/claude-opus-4.7": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
  },
  "anthropic/claude-sonnet-4.6": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "anthropic/claude-haiku-4.5": {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
  },
  "perplexity/sonar-pro": { inputPerMillion: 1.0, outputPerMillion: 1.0 },
  "perplexity/sonar-reasoning-pro": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "perplexity/sonar-reasoning": { inputPerMillion: 1.0, outputPerMillion: 1.0 },
  "moonshotai/kimi-k2.5": { inputPerMillion: 0.5, outputPerMillion: 2.0 },
  "deepseek/deepseek-v3.2": { inputPerMillion: 0.27, outputPerMillion: 1.1 },
  "openai/gpt-oss-120b": { inputPerMillion: 0.1, outputPerMillion: 0.1 },
  "openai/gpt-oss-20b": { inputPerMillion: 0.05, outputPerMillion: 0.05 },
};

/**
 * Get cost config for a model. Returns default for unknown models.
 */
export function getModelCost(modelId: string): ModelCost {
  return MODEL_COSTS[modelId] ?? DEFAULT_COST;
}

/**
 * Compute cost in rate-limit units from usage and model.
 * Unit: 10_000 units = $1 (so 1 unit = $0.0001). Returns integer for Upstash rate.
 */
export function computeCost(modelId: string, usage: Usage): number {
  const cost = getModelCost(modelId);
  const input = (usage.promptTokens ?? usage.inputTokens ?? 0) / 1_000_000;
  const output = (usage.completionTokens ?? usage.outputTokens ?? 0) / 1_000_000;
  const dollars = input * cost.inputPerMillion + output * cost.outputPerMillion;
  const units = Math.ceil(dollars * 10_000);

  return Math.max(0, units);
}
