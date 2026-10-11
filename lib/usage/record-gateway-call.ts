import "server-only";

import type { LanguageModelUsage } from "ai";

import { readGatewayBilledCostUsd } from "@/lib/usage/gateway-attribution";
import { insertLlmUsageEvent } from "@/data/supabase/llm-usage";

/**
 * Persist one single-call Gateway generation for the usage overlay. Stores the Gateway's billed
 * cost when the response carries it, otherwise the price-table estimate.
 */
export async function recordGatewayCallUsage(args: {
  ownerId: string;
  modelId: string;
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
  operation: string;
  route?: string;
}): Promise<void> {
  const billedCost = readGatewayBilledCostUsd(args.providerMetadata);
  if (!args.usage && billedCost === undefined) return;

  await insertLlmUsageEvent({
    ownerId: args.ownerId,
    modelId: args.modelId,
    inputTokens: args.usage?.inputTokens,
    outputTokens: args.usage?.outputTokens,
    cachedInputTokens: args.usage?.inputTokenDetails?.cacheReadTokens,
    reasoningTokens: args.usage?.outputTokenDetails?.reasoningTokens,
    totalTokens: args.usage?.totalTokens,
    operation: args.operation,
    route: args.route,
    costUsdOverride: billedCost,
  });
}
