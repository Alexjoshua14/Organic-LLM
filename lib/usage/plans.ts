/** Reference plan tiers for allotment comparison (not billing — illustrative). */
export type UsagePlanTier = {
  id: "free" | "plus" | "pro";
  name: string;
  /** Monthly subscription price in USD. */
  priceUsd: number;
  /** Included token budget per billing cycle (approximate). */
  tokenCap: number;
  /** Included spend cap per billing cycle (USD at list model pricing). */
  costCapUsd: number;
};

export const USAGE_PLAN_TIERS: UsagePlanTier[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    tokenCap: 500_000,
    costCapUsd: 2,
  },
  {
    id: "plus",
    name: "Plus",
    priceUsd: 20,
    tokenCap: 10_000_000,
    costCapUsd: 20,
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 60,
    tokenCap: 50_000_000,
    costCapUsd: 60,
  },
];

export function getUsagePlanTier(id: UsagePlanTier["id"]): UsagePlanTier {
  const tier = USAGE_PLAN_TIERS.find((plan) => plan.id === id);

  if (!tier) throw new Error(`Unknown plan tier: ${id}`);

  return tier;
}

export function computePlanAllotmentPercent(args: {
  plan: UsagePlanTier;
  billingCycleTokens: number;
  billingCycleCostUsd: number;
}): number {
  const { plan, billingCycleTokens, billingCycleCostUsd } = args;
  const tokenPct = plan.tokenCap > 0 ? (billingCycleTokens / plan.tokenCap) * 100 : 0;
  const costPct = plan.costCapUsd > 0 ? (billingCycleCostUsd / plan.costCapUsd) * 100 : 0;

  return Math.min(999, Math.max(tokenPct, costPct));
}

export function formatPlanTooltip(plan: UsagePlanTier): string {
  const tokenLabel =
    plan.tokenCap >= 1_000_000
      ? `${(plan.tokenCap / 1_000_000).toFixed(0)}M tokens/mo`
      : `${Math.round(plan.tokenCap / 1_000)}K tokens/mo`;

  if (plan.priceUsd === 0) {
    return `${tokenLabel} · ~$${plan.costCapUsd.toFixed(0)} API spend cap`;
  }

  return `$${plan.priceUsd}/mo · ${tokenLabel} · ~$${plan.costCapUsd.toFixed(0)} API spend cap`;
}
