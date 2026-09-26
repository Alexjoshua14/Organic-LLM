/**
 * Plan capacity math for the signed-in /plans page.
 *
 * Product tiers today are only `free` and `max` (see lib/plans/plan-tags.ts).
 * Plus/Pro rows in lib/usage/plans.ts are allotment references — not sold here.
 *
 * --- Estimators (single source; do not duplicate token prices elsewhere) ---
 *
 * Rabbit hole (estimate):
 *   Generation uses openai/gpt-6-sol for the article body (lib/llm/rabbit-hole/generation.ts).
 *   Assumed typical usage per hole: 8_000 input + 4_000 output tokens.
 *   At list rates ($2 / $10 per 1M): 8k×$2/1M + 4k×$10/1M = $0.016 + $0.040 = $0.056.
 *   Budget headroom: FREE $40 / $0.056 ≈ 714 holes. Published layman figure: 120
 *   (120 × $0.056 = $6.72 ≪ $40). User-offered 120 fits; not inflated to the ceiling.
 *
 * Realtime voice (estimate):
 *   Default Speak model gpt-realtime-2.1-mini via estimateRealtimeMinuteCostUsd
 *   (lib/rate-limit/llm-cost.ts) ≈ $0.0156 / wall-clock minute.
 *   5 hours = 300 min → 300 × $0.0156 = $4.68 ≪ $40. Published: 5 hours.
 *   ($40 would cover ~42 h at that rate; we publish the conservative product figure.)
 *
 * Simultaneous streams:
 *   Published free-tier (and current max) cap: 5. Enforced via threads.active_stream_id
 *   count in the shared LLM chat gate — reuses existing stream markers, not a new queue.
 */

import { estimateRealtimeMinuteCostUsd, computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";
import { FREE_PLAN_MONTHLY_BUDGET_USD } from "@/lib/plans/plan-tags";
import { LLM_MESSAGE_RATE_LIMIT } from "@/lib/rate-limit/catalog";
import { getUsagePlanTier } from "@/lib/usage/plans";

/** Published free-tier simultaneous LLM stream ceiling (product copy + gate). */
export const FREE_PLAN_MAX_SIMULTANEOUS_STREAMS = 5;

/**
 * Max currently shares the free stream ceiling until product sets a distinct one.
 * See docs/hub/open-questions.md — "Max plan simultaneous stream cap".
 */
export const MAX_PLAN_MAX_SIMULTANEOUS_STREAMS = FREE_PLAN_MAX_SIMULTANEOUS_STREAMS;

/** Rabbit-hole article model used by generation.ts (openai.sol → gpt-6-sol). */
export const PLAN_CAPACITY_RABBIT_HOLE_MODEL_ID = "openai/gpt-6-sol";

/** Default Speak Realtime model id (matches getSpeakRealtimeModel fallback). */
export const PLAN_CAPACITY_REALTIME_MODEL_ID = "gpt-realtime-2.1-mini";

/** Documented estimate: tokens for one rabbit-hole article generation. */
export const PLAN_CAPACITY_RABBIT_HOLE_ESTIMATE_USAGE = {
  inputTokens: 8_000,
  outputTokens: 4_000,
} as const;

/** Published layman rabbit-hole count for free (fits under $40 at the estimate above). */
export const FREE_PLAN_PUBLISHED_RABBIT_HOLES = 120;

/** Published layman realtime voice hours for free (fits under $40 at the minute estimate). */
export const FREE_PLAN_PUBLISHED_VOICE_HOURS = 5;

export function estimateRabbitHoleCostUsd(): number {
  return computeUsageCostUsd(PLAN_CAPACITY_RABBIT_HOLE_MODEL_ID, {
    ...PLAN_CAPACITY_RABBIT_HOLE_ESTIMATE_USAGE,
  });
}

export function estimateRealtimeHourCostUsd(
  modelId: string = PLAN_CAPACITY_REALTIME_MODEL_ID
): number {
  return estimateRealtimeMinuteCostUsd(modelId) * 60;
}

/** Max rabbit holes the free dollar budget could fund at the documented estimate. */
export function freeBudgetMaxRabbitHoles(budgetUsd: number = FREE_PLAN_MONTHLY_BUDGET_USD): number {
  const perHole = estimateRabbitHoleCostUsd();

  if (perHole <= 0) return 0;

  return Math.floor(budgetUsd / perHole);
}

/** Max realtime voice hours the free dollar budget could fund at the documented estimate. */
export function freeBudgetMaxVoiceHours(budgetUsd: number = FREE_PLAN_MONTHLY_BUDGET_USD): number {
  const perHour = estimateRealtimeHourCostUsd();

  if (perHour <= 0) return 0;

  return Math.floor((budgetUsd / perHour) * 10) / 10;
}

/** True when a published free capacity claim fits under the dollar budget. */
export function publishedFreeCapacityFitsBudget(args: {
  rabbitHoles: number;
  voiceHours: number;
  budgetUsd?: number;
}): boolean {
  const budget = args.budgetUsd ?? FREE_PLAN_MONTHLY_BUDGET_USD;
  const rabbitCost = args.rabbitHoles * estimateRabbitHoleCostUsd();
  const voiceCost = args.voiceHours * estimateRealtimeHourCostUsd();

  return rabbitCost <= budget && voiceCost <= budget;
}

export function evaluateSimultaneousStreamGate(args: {
  activeStreamCount: number;
  maxStreams: number;
}): { ok: true } | { ok: false; holdReason: string } {
  if (args.activeStreamCount >= args.maxStreams) {
    return {
      ok: false,
      holdReason: `Simultaneous LLM stream limit (${args.maxStreams}) reached`,
    };
  }

  return { ok: true };
}

export type PlanPublicTierId = "free" | "max";

export type PlanPublicTier = {
  id: PlanPublicTierId;
  name: string;
  /** Null when the tier has no public subscription price (max is allowlist / uncapped). */
  priceLabel: string;
  /** Null when there is no numeric monthly dollar ceiling. */
  monthlyBudgetUsd: number | null;
  /** Token allotment from usage plan table; null when unset (max). */
  tokenCap: number | null;
  rabbitHoles: number | null;
  voiceHours: number | null;
  simultaneousStreams: number;
  /** Requests-per-window from the LLM message rate-limit catalog. */
  llmRequestsPerMinute: number;
};

export function getPublicPlanTiers(): PlanPublicTier[] {
  const freeUsage = getUsagePlanTier("free");
  const maxUsage = getUsagePlanTier("max");

  return [
    {
      id: "free",
      name: "Free",
      priceLabel: "$0",
      monthlyBudgetUsd: FREE_PLAN_MONTHLY_BUDGET_USD,
      tokenCap: freeUsage.tokenCap > 0 ? freeUsage.tokenCap : null,
      rabbitHoles: FREE_PLAN_PUBLISHED_RABBIT_HOLES,
      voiceHours: FREE_PLAN_PUBLISHED_VOICE_HOURS,
      simultaneousStreams: FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
      llmRequestsPerMinute: LLM_MESSAGE_RATE_LIMIT.cap,
    },
    {
      id: "max",
      name: "Max",
      priceLabel: "Uncapped",
      monthlyBudgetUsd: maxUsage.costCapUsd,
      tokenCap: maxUsage.tokenCap > 0 ? maxUsage.tokenCap : null,
      // Dollar budget is uncapped — do not promise unlimited rabbit holes / voice.
      rabbitHoles: null,
      voiceHours: null,
      simultaneousStreams: MAX_PLAN_MAX_SIMULTANEOUS_STREAMS,
      llmRequestsPerMinute: LLM_MESSAGE_RATE_LIMIT.cap,
    },
  ];
}
