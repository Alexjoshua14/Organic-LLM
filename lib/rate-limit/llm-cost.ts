/**
 * Model cost table and cost computation for LLM rate limiting.
 * Prices in USD per million tokens (input / output). Update from provider pricing pages as needed.
 */

export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
  /** Realtime audio input tokens (≈1 token / 100ms user audio). */
  audioInputTokens?: number;
  /** Realtime audio output tokens (≈1 token / 50ms assistant audio). */
  audioOutputTokens?: number;
};

/** Input and output cost per million tokens (USD). */
export type ModelCost = {
  inputPerMillion: number;
  outputPerMillion: number;
  /** Prompt cache read pricing when the provider reports cached input tokens. */
  cachedInputPerMillion?: number;
  /** Realtime audio input cost per million tokens (USD). */
  audioInputPerMillion?: number;
  /** Realtime audio output cost per million tokens (USD). */
  audioOutputPerMillion?: number;
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
  "openai/gpt-5.6-sol": { inputPerMillion: 5.0, outputPerMillion: 30.0 },
  "openai/gpt-5.6-terra": { inputPerMillion: 2.5, outputPerMillion: 15.0 },
  "openai/gpt-5.6-luna": { inputPerMillion: 1.0, outputPerMillion: 6.0 },
  "openai/gpt-5.5": { inputPerMillion: 5.0, outputPerMillion: 30.0 },
  "openai/gpt-5.5-pro": { inputPerMillion: 30.0, outputPerMillion: 180.0 },
  "openai/gpt-5.4": { inputPerMillion: 2.5, outputPerMillion: 15.0 },
  "openai/gpt-5.4-mini": { inputPerMillion: 0.75, outputPerMillion: 4.5 },
  "openai/gpt-5.4-nano": { inputPerMillion: 0.2, outputPerMillion: 1.25 },
  "openai/gpt-5.2": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  "openai/gpt-5": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  "openai/gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  "openai/gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "openai/gpt-4-turbo": { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  "google/gemini-3.1-pro-preview": { inputPerMillion: 2.0, outputPerMillion: 12.0 },
  "google/gemini-3.6-flash": { inputPerMillion: 1.5, outputPerMillion: 7.5 },
  "google/gemini-3.5-flash": { inputPerMillion: 1.5, outputPerMillion: 9.0 },
  "google/gemini-3-flash": { inputPerMillion: 0.5, outputPerMillion: 3.0 },
  "google/gemini-3.5-flash-lite": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "google/gemini-2.5-flash-lite": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "anthropic/claude-opus-5": { inputPerMillion: 5.0, outputPerMillion: 25.0 },
  "anthropic/claude-opus-4.8": { inputPerMillion: 5.0, outputPerMillion: 25.0 },
  "anthropic/claude-fable-5": { inputPerMillion: 10.0, outputPerMillion: 50.0 },
  "anthropic/claude-opus-4.7": { inputPerMillion: 5.0, outputPerMillion: 25.0 },
  "anthropic/claude-sonnet-5": { inputPerMillion: 2.0, outputPerMillion: 10.0 },
  "anthropic/claude-sonnet-4.6": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "anthropic/claude-haiku-4.5": { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  "perplexity/sonar-pro": { inputPerMillion: 1.0, outputPerMillion: 1.0 },
  "perplexity/sonar-reasoning-pro": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "moonshotai/kimi-k3": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "moonshotai/kimi-k2.7-code": { inputPerMillion: 0.95, outputPerMillion: 4.0 },
  "moonshotai/kimi-k2.6": { inputPerMillion: 0.95, outputPerMillion: 4.0 },
  "deepseek/deepseek-v4-pro": { inputPerMillion: 0.44, outputPerMillion: 0.87 },
  "deepseek/deepseek-v4-flash": { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  "deepseek/deepseek-v3.2": { inputPerMillion: 0.28, outputPerMillion: 0.42 },
  "openai/gpt-oss-120b": { inputPerMillion: 0.35, outputPerMillion: 0.75 },
  "openai/gpt-oss-20b": { inputPerMillion: 0.05, outputPerMillion: 0.2 },
  // OpenAI Realtime (audio + text). Prefer mini while developing.
  "openai/gpt-realtime-mini": {
    inputPerMillion: 0.6,
    outputPerMillion: 2.4,
    cachedInputPerMillion: 0.06,
    audioInputPerMillion: 10.0,
    audioOutputPerMillion: 20.0,
  },
  "openai/gpt-realtime": {
    inputPerMillion: 4.0,
    outputPerMillion: 16.0,
    cachedInputPerMillion: 0.4,
    audioInputPerMillion: 32.0,
    audioOutputPerMillion: 64.0,
  },
  "openai/gpt-realtime-2.1-mini": {
    inputPerMillion: 0.6,
    outputPerMillion: 2.4,
    cachedInputPerMillion: 0.06,
    audioInputPerMillion: 10.0,
    audioOutputPerMillion: 20.0,
  },
  "openai/gpt-realtime-2.1": {
    inputPerMillion: 4.0,
    outputPerMillion: 16.0,
    cachedInputPerMillion: 0.4,
    audioInputPerMillion: 32.0,
    audioOutputPerMillion: 64.0,
  },
};

/**
 * Get cost config for a model. Returns default for unknown models.
 * Cached input rates follow common provider discounts when not listed explicitly.
 */
export function getModelCost(modelId: string): ModelCost {
  const base = MODEL_COSTS[modelId] ?? DEFAULT_COST;

  if (base.cachedInputPerMillion !== undefined) return base;
  if (modelId.startsWith("openai/")) {
    return { ...base, cachedInputPerMillion: base.inputPerMillion * 0.5 };
  }
  if (modelId.startsWith("anthropic/")) {
    return { ...base, cachedInputPerMillion: base.inputPerMillion * 0.1 };
  }
  if (modelId.startsWith("google/")) {
    return { ...base, cachedInputPerMillion: base.inputPerMillion * 0.25 };
  }

  return base;
}

/**
 * Compute cost in rate-limit units from usage and model.
 * Unit: 10_000 units = $1 (so 1 unit = $0.0001). Returns integer for Upstash rate.
 */
export function computeCost(modelId: string, usage: Usage): number {
  const dollars = computeUsageCostUsd(modelId, usage);

  return Math.max(0, Math.ceil(dollars * 10_000));
}

/** Cost in USD from usage and model (same pricing table as rate limits). */
export function computeUsageCostUsd(modelId: string, usage: Usage): number {
  const cost = getModelCost(modelId);
  const input = usage.promptTokens ?? usage.inputTokens ?? 0;
  const output = usage.completionTokens ?? usage.outputTokens ?? 0;
  const cached = usage.cachedInputTokens ?? 0;
  const uncachedInput = Math.max(0, input - cached);
  const audioIn = usage.audioInputTokens ?? 0;
  const audioOut = usage.audioOutputTokens ?? 0;

  const inputCost = (uncachedInput / 1_000_000) * cost.inputPerMillion;
  const cachedCost =
    cached > 0 && cost.cachedInputPerMillion !== undefined
      ? (cached / 1_000_000) * cost.cachedInputPerMillion
      : 0;
  const outputCost = (output / 1_000_000) * cost.outputPerMillion;
  const audioInCost =
    audioIn > 0 && cost.audioInputPerMillion !== undefined
      ? (audioIn / 1_000_000) * cost.audioInputPerMillion
      : 0;
  const audioOutCost =
    audioOut > 0 && cost.audioOutputPerMillion !== undefined
      ? (audioOut / 1_000_000) * cost.audioOutputPerMillion
      : 0;

  return inputCost + cachedCost + outputCost + audioInCost + audioOutCost;
}

/**
 * Conservative wall-clock minute estimate for Realtime when token events lag.
 * Assumes ~50/50 user/assistant speech within the minute.
 */
export function estimateRealtimeMinuteCostUsd(modelId: string): number {
  const id = normalizeRealtimeModelId(modelId);
  const cost = getModelCost(id);
  const textPad = 200;
  const audioInPerMin = 300; // 30s user @ 1 tok/100ms
  const audioOutPerMin = 600; // 30s assistant @ 1 tok/50ms

  if (cost.audioInputPerMillion === undefined || cost.audioOutputPerMillion === undefined) {
    return computeUsageCostUsd(id, {
      inputTokens: textPad + audioInPerMin,
      outputTokens: textPad + audioOutPerMin,
    });
  }

  return computeUsageCostUsd(id, {
    inputTokens: textPad,
    outputTokens: textPad,
    audioInputTokens: audioInPerMin,
    audioOutputTokens: audioOutPerMin,
  });
}

/** Normalize Realtime model ids to `openai/...` pricing keys. */
export function normalizeRealtimeModelId(modelId: string): string {
  if (modelId.startsWith("openai/")) return modelId;

  return `openai/${modelId}`;
}

/** Cost units for Upstash: 10_000 units = $1. */
export function costUnitsFromUsd(usd: number): number {
  return Math.max(0, Math.ceil(usd * 10_000));
}

/** When the MODEL_COSTS table was last reviewed (update with pricing changes). */
export const MODEL_PRICING_AS_OF = "2026-07-19";
