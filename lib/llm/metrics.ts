import "server-only";

import { createLogger } from "@/lib/logger";
import { trackLlmUsageEvent } from "@/lib/usage/track-llm-usage";

const logger = createLogger("lib/llm/metrics.ts");

type LlmUsageLike = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
};

type LlmCallMetadata = {
  operation?: string;
  route?: string;
  contextId?: string;
  /** When set, usage is persisted for the usage overlay. */
  userId?: string;
};

type LlmModelTotals = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  totalDurationMs: number;
};

const modelTotals = new Map<string, LlmModelTotals>();

function coerceCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getOrCreateTotals(model: string): LlmModelTotals {
  const existing = modelTotals.get(model);

  if (existing) return existing;
  const created: LlmModelTotals = {
    model,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    totalDurationMs: 0,
  };

  modelTotals.set(model, created);

  return created;
}

export function recordLlmCall(args: {
  model: string;
  usage?: LlmUsageLike | null;
  durationMs: number;
  metadata?: LlmCallMetadata;
}) {
  const { model, usage, durationMs, metadata } = args;

  const inputTokens = coerceCount(usage?.inputTokens);
  const outputTokens = coerceCount(usage?.outputTokens);
  const cachedInputTokens = coerceCount(usage?.cachedInputTokens);
  const reasoningTokens = coerceCount(usage?.reasoningTokens);
  const totalTokens = coerceCount(usage?.totalTokens) || inputTokens + outputTokens;

  const totals = getOrCreateTotals(model);

  totals.calls += 1;
  totals.inputTokens += inputTokens;
  totals.outputTokens += outputTokens;
  totals.reasoningTokens += reasoningTokens;
  totals.totalTokens += totalTokens;
  totals.totalDurationMs += durationMs;

  logger.log(
    "recordLlmCall",
    JSON.stringify({
      model,
      durationMs,
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      metadata: metadata ?? {},
      totalsForModel: {
        calls: totals.calls,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        reasoningTokens: totals.reasoningTokens,
        totalTokens: totals.totalTokens,
        totalDurationMs: totals.totalDurationMs,
      },
    })
  );

  if (metadata?.userId && totalTokens > 0) {
    trackLlmUsageEvent({
      ownerId: metadata.userId,
      modelId: model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningTokens,
      totalTokens,
      operation: metadata.operation,
      route: metadata.route,
    });
  }
}

export function getLlmModelTotals(): LlmModelTotals[] {
  return Array.from(modelTotals.values());
}
