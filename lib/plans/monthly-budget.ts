import "server-only";

import { fetchLlmUsageEvents } from "@/data/supabase/llm-usage";
import { startOfBillingCycle } from "@/lib/usage/aggregate";
import {
  evaluatePlanBudget,
  resolvePlanTag,
  type PlanBudgetSnapshot,
  type PlanTag,
} from "@/lib/plans/plan-tags";

/**
 * Monthly spend for plan gating = sum of llm_usage_events.cost_usd in the
 * current UTC calendar month. Cost is computed at insert time via
 * lib/rate-limit/llm-cost (same estimator as the usage overlay).
 */
export async function sumMonthlyUsageCostUsd(ownerId: string, now = new Date()): Promise<number> {
  const since = startOfBillingCycle(now);
  const events = await fetchLlmUsageEvents({ ownerId, since });

  return events.reduce((sum, e) => sum + (Number(e.cost_usd) || 0), 0);
}

export async function getPlanBudgetForUser(args: {
  clerkUserId: string;
  ownerId: string;
  now?: Date;
}): Promise<PlanBudgetSnapshot> {
  const plan: PlanTag = resolvePlanTag(args.clerkUserId);
  const monthlyUsedUsd = await sumMonthlyUsageCostUsd(args.ownerId, args.now);

  return evaluatePlanBudget({ plan, monthlyUsedUsd });
}
