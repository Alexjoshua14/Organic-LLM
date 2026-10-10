import type { LanguageModelUsage } from "ai";
import type { ContextBudgetUsage } from "@/lib/chat/context-budget";

import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";
import { readGatewayBilledCostUsd } from "@/lib/usage/gateway-attribution";

export type ContextBudgetUsageStep = {
  usage: LanguageModelUsage;
  providerMetadata?: unknown;
};

/** Missing provider fields stay unknown; they must not appear as zero cache use. */
export function summarizeContextBudgetUsage(
  modelId: string,
  steps: ContextBudgetUsageStep[],
  complete = false
): ContextBudgetUsage {
  function sumReported(read: (step: ContextBudgetUsageStep) => number | undefined) {
    const values = steps.map(read);

    return values.length > 0 && values.every((value) => value != null && Number.isFinite(value))
      ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : undefined;
  }

  const inputTokens = sumReported((step) => step.usage.inputTokens);
  const cachedInputTokens = sumReported((step) => step.usage.inputTokenDetails.cacheReadTokens);
  const outputTokens = sumReported((step) => step.usage.outputTokens);
  const billedCost = sumReported((step) => readGatewayBilledCostUsd(step.providerMetadata));
  const estimatedCost =
    inputTokens != null && cachedInputTokens != null && outputTokens != null
      ? computeUsageCostUsd(modelId, { inputTokens, cachedInputTokens, outputTokens })
      : undefined;

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    costUsd: billedCost ?? estimatedCost,
    costSource: billedCost != null ? "gateway" : estimatedCost != null ? "estimate" : undefined,
    modelCalls: steps.length,
    complete,
  };
}
