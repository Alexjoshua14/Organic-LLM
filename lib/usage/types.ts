import type { BudgetCycleRange } from "@/lib/plans/budget-cycle";
import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";
import type { UsagePlanTier } from "@/lib/usage/plans";
import type { UsageTotals, UsageDailyBucket, UsageModelBreakdown } from "@/lib/usage/aggregate";

export type GatewaySpendSummary =
  | { status: "available"; accountCostUsd: number; attributedCostUsd: number; asOf: string }
  | { status: "unavailable" };

export type UsageApiPayload = {
  gatewaySpend?: GatewaySpendSummary;
  /** The budget cycles shown. */
  range: { start: string; end: string; preset: BudgetCycleRange };
  /** The current weekly budget window (end = when it resets). */
  billingCycle: { start: string; end: string };
  /** Verified plan, spend in the current window, resets left, and whether requests may run. */
  plan: PlanBudgetSnapshot;
  totals: UsageTotals;
  billingCycleTotals: UsageTotals;
  daily: UsageDailyBucket[];
  byModel: Array<
    UsageModelBreakdown & {
      inputPerMillion: number;
      outputPerMillion: number;
      cachedInputPerMillion?: number;
    }
  >;
  planAllotments: Array<{
    plan: UsagePlanTier;
    percentUsed: number;
  }>;
  pricingAsOf: string;
};
