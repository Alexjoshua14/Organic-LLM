/** Reference plan tiers for allotment comparison and multi-mode budget gating. */
export type UsagePlanTierId = "free" | "plus" | "pro" | "max";

export type UsagePlanTier = {
  id: UsagePlanTierId;
  name: string;
  /** Monthly subscription price in USD. */
  priceUsd: number;
  /** Included token budget per billing cycle (approximate). */
  tokenCap: number;
  /**
   * Included spend cap per billing cycle (USD at list model pricing).
   * Null when unset (`max` plan — no numeric ceiling defined yet).
   */
  costCapUsd: number | null;
};

export const USAGE_PLAN_TIERS: UsagePlanTier[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    tokenCap: 500_000,
    /** Matches multi-mode free monthly budget (lib/plans/plan-tags.ts). */
    costCapUsd: 40,
  },
  {
    id: "plus",
    name: "Plus",
    priceUsd: 20,
    tokenCap: 10_000_000,
    costCapUsd: 30,
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 60,
    tokenCap: 50_000_000,
    costCapUsd: 60,
  },
  {
    id: "max",
    name: "Max",
    priceUsd: 0,
    tokenCap: 0,
    /** Numeric ceiling unset — max is not subject to the free $40 cap. */
    costCapUsd: null,
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
  const costPct =
    plan.costCapUsd != null && plan.costCapUsd > 0
      ? (billingCycleCostUsd / plan.costCapUsd) * 100
      : 0;

  return Math.min(999, Math.max(tokenPct, costPct));
}

export function formatPlanTooltip(plan: UsagePlanTier): string {
  if (plan.costCapUsd == null) {
    return "Max plan · monthly spend ceiling unset";
  }

  const tokenLabel =
    plan.tokenCap >= 1_000_000
      ? `${(plan.tokenCap / 1_000_000).toFixed(0)}M tokens/mo`
      : `${Math.round(plan.tokenCap / 1_000)}K tokens/mo`;

  if (plan.priceUsd === 0) {
    return `${tokenLabel} · ~$${plan.costCapUsd.toFixed(0)} API spend cap`;
  }

  return `$${plan.priceUsd}/mo · ${tokenLabel} · ~$${plan.costCapUsd.toFixed(0)} API spend cap`;
}
