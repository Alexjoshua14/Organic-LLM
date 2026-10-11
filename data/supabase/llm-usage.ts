import "server-only";

import type { BudgetCycleRange } from "@/lib/plans/budget-cycle";
import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";
import type { LlmUsageEventRow } from "@/lib/usage/aggregate";
import type { UsageApiPayload } from "@/lib/usage/types";

import { createLogger } from "@/lib/logger";
import { computeUsageCostUsd, getModelCost, MODEL_PRICING_AS_OF } from "@/lib/rate-limit/llm-cost";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { budgetCycleRangeSpan } from "@/lib/plans/budget-cycle";
import { aggregateUsageEvents } from "@/lib/usage/aggregate";
import { computePlanAllotmentPercent, USAGE_PLAN_TIERS } from "@/lib/usage/plans";

const logger = createLogger("data/supabase/llm-usage.ts");

/** Supabase's default max rows per request; reads page in steps of this size. */
const COST_PAGE_SIZE = 1_000;

export type TrackLlmUsageInput = {
  ownerId: string;
  modelId: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  /** Realtime audio — priced via {@link computeUsageCostUsd} audio rates. */
  audioInputTokens?: number | null;
  audioOutputTokens?: number | null;
  operation?: string;
  route?: string;
  /**
   * Billed USD reported by the Gateway for this call. When set, stored instead of the
   * price-table estimate so the overlay shows what was actually charged.
   */
  costUsdOverride?: number | null;
};

export async function insertLlmUsageEvent(input: TrackLlmUsageInput): Promise<void> {
  const inputTokens = coerceCount(input.inputTokens);
  const outputTokens = coerceCount(input.outputTokens);
  const cachedInputTokens = coerceCount(input.cachedInputTokens);
  const reasoningTokens = coerceCount(input.reasoningTokens);
  const audioInputTokens = coerceCount(input.audioInputTokens);
  const audioOutputTokens = coerceCount(input.audioOutputTokens);
  const totalTokens =
    coerceCount(input.totalTokens) ||
    inputTokens + outputTokens + reasoningTokens + audioInputTokens + audioOutputTokens;

  const billed = input.costUsdOverride;
  const costUsd =
    typeof billed === "number" && Number.isFinite(billed) && billed >= 0
      ? billed
      : computeUsageCostUsd(input.modelId, {
          inputTokens,
          outputTokens,
          cachedInputTokens,
          audioInputTokens,
          audioOutputTokens,
        });

  // A provider can report a billed charge without token details. Preserve that charge.
  if (totalTokens <= 0 && costUsd <= 0) return;

  const { error } = await supabaseAdmin.from("llm_usage_events").insert({
    owner_id: input.ownerId,
    model_id: input.modelId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_input_tokens: cachedInputTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    operation: input.operation ?? null,
    route: input.route ?? null,
  });

  if (error) {
    logger.warn("insertLlmUsageEvent", error.message);
    throw new Error("Usage could not be recorded");
  }
}

/** Most rows read for one dashboard view (pages of {@link COST_PAGE_SIZE}). */
const USAGE_EVENTS_MAX_ROWS = 20_000;

export async function fetchLlmUsageEvents(args: {
  ownerId: string;
  since: Date;
}): Promise<LlmUsageEventRow[]> {
  const { ownerId, since } = args;
  const rows: LlmUsageEventRow[] = [];

  // Page past the default row limit so a busy span is not silently truncated.
  for (let from = 0; from < USAGE_EVENTS_MAX_ROWS; from += COST_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("llm_usage_events")
      .select(
        "id, owner_id, model_id, input_tokens, output_tokens, cached_input_tokens, reasoning_tokens, total_tokens, cost_usd, operation, route, created_at"
      )
      .eq("owner_id", ownerId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .range(from, from + COST_PAGE_SIZE - 1);

    if (error) {
      if (isMissingTableError(error.message)) {
        logger.warn("fetchLlmUsageEvents", "llm_usage_events table missing — run migration");
      } else {
        logger.warn("fetchLlmUsageEvents", error.message);
      }

      return rows;
    }
    rows.push(...((data ?? []) as LlmUsageEventRow[]));
    if ((data?.length ?? 0) < COST_PAGE_SIZE) break;
  }

  return rows;
}

/** Result of a spend read. Gating fails closed on `error`; `missing` means not migrated yet. */
export type UsageCostSum =
  | { status: "ok"; usd: number }
  | { status: "missing" }
  | { status: "error"; message: string };

/**
 * Spend in `[since, until)`. Uses the `sum_llm_usage_cost` RPC (one row back, index-backed);
 * until that migration runs, pages through `cost_usd` so a busy week is never truncated at the
 * default row limit.
 */
export async function sumLlmUsageCostUsd(args: {
  ownerId: string;
  since: Date;
  until: Date;
  /** Once entitlements exist, the RPC must include adjustments; never fall back to charges only. */
  requireRpc?: boolean;
}): Promise<UsageCostSum> {
  const rpc = await supabaseAdmin.rpc("sum_llm_usage_cost", {
    p_owner: args.ownerId,
    p_since: args.since.toISOString(),
    p_until: args.until.toISOString(),
  });

  if (!rpc.error) {
    const raw = rpc.data;
    const usd =
      typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : Number.NaN;

    return Number.isFinite(usd) && usd >= 0
      ? { status: "ok", usd }
      : { status: "error", message: "Bad sum" };
  }
  if (!isMissingFunctionError(rpc.error.message, rpc.error.code)) {
    logger.warn("sumLlmUsageCostUsd", rpc.error.message);

    return { status: "error", message: rpc.error.message };
  }
  if (args.requireRpc) return { status: "error", message: "Budget ledger RPC unavailable" };

  let usd = 0;

  for (let from = 0; ; from += COST_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("llm_usage_events")
      .select("cost_usd")
      .eq("owner_id", args.ownerId)
      .gte("created_at", args.since.toISOString())
      .lt("created_at", args.until.toISOString())
      .order("created_at", { ascending: true })
      .range(from, from + COST_PAGE_SIZE - 1);

    if (error) {
      if (isMissingTableError(error.message)) return { status: "missing" };
      logger.warn("sumLlmUsageCostUsd", error.message);

      return { status: "error", message: error.message };
    }
    for (const row of data ?? []) {
      const cost = Number(row.cost_usd);
      if (!Number.isFinite(cost) || cost < 0) return { status: "error", message: "Bad cost" };
      usd += cost;
    }
    if ((data?.length ?? 0) < COST_PAGE_SIZE) return { status: "ok", usd };
  }
}

function isMissingFunctionError(message: string, code?: string): boolean {
  return (
    code === "PGRST202" || (message.includes("sum_llm_usage_cost") && message.includes("not find"))
  );
}

export type { UsageApiPayload } from "@/lib/usage/types";

export async function buildUsageSummaryForUser(args: {
  ownerId: string;
  range: BudgetCycleRange;
  plan: PlanBudgetSnapshot;
  now?: Date;
}): Promise<UsageApiPayload> {
  const { ownerId, range, plan } = args;
  const now = args.now ?? new Date();
  const cycleStart = new Date(plan.cycleStart);
  const span = budgetCycleRangeSpan(range, cycleStart, now);
  const fetchSince = span.start < cycleStart ? span.start : cycleStart;

  const events = await fetchLlmUsageEvents({ ownerId, since: fetchSince });
  const rangeAgg = aggregateUsageEvents(events, span.start, span.end);
  const cycleAgg = aggregateUsageEvents(events, cycleStart, now);

  const byModel = rangeAgg.byModel.map((row) => {
    const pricing = getModelCost(row.modelId);

    return {
      ...row,
      inputPerMillion: pricing.inputPerMillion,
      outputPerMillion: pricing.outputPerMillion,
      ...(pricing.cachedInputPerMillion !== undefined
        ? { cachedInputPerMillion: pricing.cachedInputPerMillion }
        : {}),
    };
  });

  const planAllotments = USAGE_PLAN_TIERS.filter((tier) => tier.id !== "max").map((tier) => ({
    plan: tier,
    percentUsed: computePlanAllotmentPercent({
      plan: tier,
      billingCycleTokens: cycleAgg.totals.totalTokens,
      billingCycleCostUsd: plan.usedUsd,
    }),
  }));

  return {
    range: { start: span.start.toISOString(), end: span.end.toISOString(), preset: range },
    billingCycle: { start: plan.cycleStart, end: plan.cycleEnd },
    plan,
    totals: rangeAgg.totals,
    billingCycleTotals: cycleAgg.totals,
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
