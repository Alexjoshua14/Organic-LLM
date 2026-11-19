/**
 * Plan tiers. `costCapUsd` is the spend allowed per weekly budget cycle
 * (lib/plans/budget-cycle.ts); reaching it stops new LLM requests until the window resets or
 * the user spends a reset. A user's plan is verified server-side (account_entitlements).
 */
export type UsagePlanTierId = "agent" | "free" | "plus" | "pro" | "max";

export type UsagePlanTier = {
  id: UsagePlanTierId;
  name: string;
  /** Monthly subscription price in USD. */
  priceUsd: number;
  /** Reference token allotment per weekly cycle (display only; spend is what gates). */
  tokenCap: number;
  /**
   * Spend cap per weekly cycle (USD at list model pricing). Null when uncapped (`max`).
   */
  costCapUsd: number | null;
};

export const USAGE_PLAN_TIERS: UsagePlanTier[] = [
  {
    // Hidden, below free: AI coding agents' test accounts (lib/agent-account/agent-account.ts).
    // Assigned by env only, never listed or sold. Owner-approved 2026-11-18; raise only when
    // agents demonstrably need more.
    id: "agent",
    name: "Agent test",
    priceUsd: 0,
    tokenCap: 0,
    costCapUsd: 0.5,
  },
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    tokenCap: 2_500_000,
    // Generous while access is waitlisted and approved by hand; lowered before public launch.
    costCapUsd: 10,
  },
  {
    // Interim weekly caps for plus and pro until the owner sets them; never below free.
    id: "plus",
    name: "Plus",
    priceUsd: 20,
    tokenCap: 4_000_000,
    costCapUsd: 15,
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 60,
    tokenCap: 7_500_000,
    costCapUsd: 25,
  },
  {
    id: "max",
    name: "Max",
    priceUsd: 0,
    tokenCap: 0,
    /** Uncapped. */
    costCapUsd: null,
  },
];

export function getUsagePlanTier(id: UsagePlanTier["id"]): UsagePlanTier {
  const tier = USAGE_PLAN_TIERS.find((plan) => plan.id === id);

  if (!tier) throw new Error(`Unknown plan tier: ${id}`);

  return tier;
}

/** Percent of a plan's weekly spend cap used (0 for uncapped plans). */
export function computePlanAllotmentPercent(args: {
  plan: UsagePlanTier;
  billingCycleTokens: number;
  billingCycleCostUsd: number;
}): number {
  const { plan, billingCycleCostUsd } = args;
  const costPct =
    plan.costCapUsd != null && plan.costCapUsd > 0
      ? (billingCycleCostUsd / plan.costCapUsd) * 100
      : 0;

  return Math.min(999, Math.max(0, costPct));
}

/** "$10" for whole-dollar caps, "$0.50" otherwise, so a sub-dollar cap never rounds. */
export function formatPlanCapUsd(capUsd: number): string {
  return Number.isInteger(capUsd) ? `$${capUsd.toFixed(0)}` : `$${capUsd.toFixed(2)}`;
}

export function formatPlanTooltip(plan: UsagePlanTier): string {
  if (plan.costCapUsd == null) {
    return `${plan.name} plan · no weekly spend cap`;
  }

  const spend = `${formatPlanCapUsd(plan.costCapUsd)} spend per week`;

  return plan.priceUsd === 0 ? `${plan.name} · ${spend}` : `$${plan.priceUsd}/mo · ${spend}`;
}
