import type { UsagePlanTier } from "@/lib/usage/plans";
import type { UsageRangePreset, UsageTotals, UsageDailyBucket, UsageModelBreakdown } from "@/lib/usage/aggregate";

export type UsageApiPayload = {
  range: { start: string; end: string; preset: UsageRangePreset };
  billingCycle: { start: string; end: string };
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
