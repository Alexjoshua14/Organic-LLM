/**
 * Product plan tags for monthly spend gating (multi-mode queue dispatch).
 *
 * - `free` — default for every user; $40 calendar-month API spend budget.
 * - `max` — assigned only via server-side Clerk user id allowlist (env).
 *   Numeric ceiling is intentionally unset until product defines one.
 */

export const PLAN_TAGS = ["free", "max"] as const;
export type PlanTag = (typeof PLAN_TAGS)[number];

/** Free plan: total LLM spend per calendar month (UTC), from llm_usage_events.cost_usd. */
export const FREE_PLAN_MONTHLY_BUDGET_USD = 40;

/**
 * Comma-separated Clerk user ids granted the `max` plan.
 * Example: MAX_PLAN_CLERK_USER_IDS=user_abc,user_def
 * Never put personal names or emails in source — only this env allowlist.
 */
export const MAX_PLAN_CLERK_USER_IDS_ENV = "MAX_PLAN_CLERK_USER_IDS";

export function parseMaxPlanClerkUserIds(
  raw: string | undefined = process.env[MAX_PLAN_CLERK_USER_IDS_ENV]
): Set<string> {
  if (!raw || !raw.trim()) return new Set();

  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  );
}

/** Default every user to `free`; promote to `max` only via env allowlist. */
export function resolvePlanTag(clerkUserId: string, envRaw?: string): PlanTag {
  const allowlist = parseMaxPlanClerkUserIds(envRaw);

  if (allowlist.has(clerkUserId)) return "max";

  return "free";
}

export type PlanBudgetSnapshot = {
  plan: PlanTag;
  /** Null when the plan has no numeric ceiling (`max`). */
  monthlyBudgetUsd: number | null;
  monthlyUsedUsd: number;
  monthlyRemainingUsd: number | null;
  /** True when dispatch is allowed under this plan's budget rules. */
  canDispatch: boolean;
  /** Human-readable hold reason when canDispatch is false. */
  holdReason: string | null;
};

export function evaluatePlanBudget(args: {
  plan: PlanTag;
  monthlyUsedUsd: number;
  freeBudgetUsd?: number;
}): PlanBudgetSnapshot {
  const { plan, monthlyUsedUsd } = args;
  const freeBudget = args.freeBudgetUsd ?? FREE_PLAN_MONTHLY_BUDGET_USD;
  const used = Math.max(0, monthlyUsedUsd);

  if (plan === "max") {
    return {
      plan,
      monthlyBudgetUsd: null,
      monthlyUsedUsd: used,
      monthlyRemainingUsd: null,
      canDispatch: true,
      holdReason: null,
    };
  }

  const remaining = Math.max(0, freeBudget - used);
  const canDispatch = used < freeBudget;

  return {
    plan: "free",
    monthlyBudgetUsd: freeBudget,
    monthlyUsedUsd: used,
    monthlyRemainingUsd: remaining,
    canDispatch,
    holdReason: canDispatch
      ? null
      : `Free plan monthly budget ($${freeBudget.toFixed(0)}) exhausted`,
  };
}
