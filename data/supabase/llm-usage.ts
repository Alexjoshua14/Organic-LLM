import "server-only";

import { createLogger } from "@/lib/logger";
import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import type { LlmUsageEventRow, UsageRangePreset } from "@/lib/usage/aggregate";
import {
  aggregateUsageEvents,
  startOfBillingCycle,
  usageRangeDays,
} from "@/lib/usage/aggregate";
import {
  computePlanAllotmentPercent,
  USAGE_PLAN_TIERS,
} from "@/lib/usage/plans";
import type { UsageApiPayload } from "@/lib/usage/types";

const logger = createLogger("data/supabase/llm-usage.ts");

export type TrackLlmUsageInput = {
  ownerId: string;
  modelId: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  operation?: string;
  route?: string;
};

export async function insertLlmUsageEvent(input: TrackLlmUsageInput): Promise<void> {
  const inputTokens = coerceCount(input.inputTokens);
  const outputTokens = coerceCount(input.outputTokens);
  const reasoningTokens = coerceCount(input.reasoningTokens);
  const totalTokens =
    coerceCount(input.totalTokens) || inputTokens + outputTokens + reasoningTokens;

  if (totalTokens <= 0) return;

  const costUsd = computeUsageCostUsd(input.modelId, {
    inputTokens,
    outputTokens,
  });

  const { error } = await supabaseAdmin.from("llm_usage_events").insert({
    owner_id: input.ownerId,
    model_id: input.modelId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    operation: input.operation ?? null,
    route: input.route ?? null,
  });

  if (error) {
    logger.warn("insertLlmUsageEvent", error.message);
  }
}

export async function fetchLlmUsageEvents(args: {
  ownerId: string;
  since: Date;
}): Promise<LlmUsageEventRow[]> {
  const { ownerId, since } = args;

  const { data, error } = await supabaseAdmin
    .from("llm_usage_events")
    .select(
      "id, owner_id, model_id, input_tokens, output_tokens, reasoning_tokens, total_tokens, cost_usd, operation, route, created_at"
    )
    .eq("owner_id", ownerId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error.message)) {
      logger.warn("fetchLlmUsageEvents", "llm_usage_events table missing — run migration");

      return [];
    }
    logger.warn("fetchLlmUsageEvents", error.message);

    return [];
  }

  return (data ?? []) as LlmUsageEventRow[];
}

export type { UsageApiPayload } from "@/lib/usage/types";

export async function buildUsageSummaryForUser(args: {
  ownerId: string;
  preset: UsageRangePreset;
}): Promise<UsageApiPayload> {
  const { ownerId, preset } = args;
  const now = new Date();
  const rangeEnd = now;
  const rangeStart = new Date(now);

  rangeStart.setUTCDate(rangeStart.getUTCDate() - usageRangeDays(preset) + 1);
  rangeStart.setUTCHours(0, 0, 0, 0);

  const billingStart = startOfBillingCycle(now);
  const fetchSince =
    billingStart < rangeStart ? billingStart : new Date(rangeStart.getTime() - 86_400_000);

  const events = await fetchLlmUsageEvents({ ownerId, since: fetchSince });
  const rangeAgg = aggregateUsageEvents(events, rangeStart, rangeEnd);
  const billingAgg = aggregateUsageEvents(events, billingStart, rangeEnd);

  const { getModelCost, MODEL_PRICING_AS_OF } = await import("@/lib/rate-limit/llm-cost");

  const byModel = rangeAgg.byModel.map((row) => {
    const pricing = getModelCost(row.modelId);

    return {
      ...row,
      inputPerMillion: pricing.inputPerMillion,
      outputPerMillion: pricing.outputPerMillion,
    };
  });

  const planAllotments = USAGE_PLAN_TIERS.map((plan) => ({
    plan,
    percentUsed: computePlanAllotmentPercent({
      plan,
      billingCycleTokens: billingAgg.totals.totalTokens,
      billingCycleCostUsd: billingAgg.totals.costUsd,
    }),
  }));

  return {
    range: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
      preset,
    },
    billingCycle: {
      start: billingStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
    totals: rangeAgg.totals,
    billingCycleTotals: billingAgg.totals,
    daily: rangeAgg.daily,
    byModel,
    planAllotments,
    pricingAsOf: MODEL_PRICING_AS_OF,
  };
}

function coerceCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function isMissingTableError(message: string): boolean {
  return message.includes("llm_usage_events") && message.includes("does not exist");
}
