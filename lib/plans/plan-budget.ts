import "server-only";

import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

import { readAccountEntitlement, type EntitlementRead } from "@/data/supabase/account-entitlements";
import { sumLlmUsageCostUsd, type UsageCostSum } from "@/data/supabase/llm-usage";
import { currentBudgetCycle, DEFAULT_BUDGET_CYCLE_ANCHOR } from "@/lib/plans/budget-cycle";
import {
  evaluatePlanBudget,
  parseMaxPlanClerkUserIds,
  resolvePlan,
  unavailablePlanBudget,
} from "@/lib/plans/plan-tags";

export type PlanBudgetDeps = {
  readEntitlement(profileId: string): Promise<EntitlementRead>;
  sumCost(args: {
    ownerId: string;
    since: Date;
    until: Date;
    requireRpc?: boolean;
  }): Promise<UsageCostSum>;
};

const defaultDeps: PlanBudgetDeps = {
  readEntitlement: readAccountEntitlement,
  sumCost: sumLlmUsageCostUsd,
};

/**
 * The user's plan budget for the current weekly window: verified plan, spend so far, reset
 * credits, and whether new LLM requests may run.
 *
 * - Entitlements not migrated → free plan on the default Monday window, resets unavailable.
 * - Entitlement or spend unreadable → blocked until it recovers. Never authorize on stale spend.
 */
export async function getPlanBudgetForUser(
  args: { clerkUserId?: string; ownerId: string; now?: Date },
  deps: PlanBudgetDeps = defaultDeps
): Promise<PlanBudgetSnapshot> {
  const now = args.now ?? new Date();
  let read: EntitlementRead;
  try {
    read = await deps.readEntitlement(args.ownerId);
  } catch {
    return unavailablePlanBudget(currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR, now));
  }

  if (read.status === "error") {
    return unavailablePlanBudget(currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR, now));
  }

  const entitlement = read.status === "ok" ? read.entitlement : null;
  const plan = resolvePlan({ clerkUserId: args.clerkUserId ?? "", storedPlan: entitlement?.plan });
  const source = parseMaxPlanClerkUserIds().has(args.clerkUserId ?? "")
    ? "override"
    : entitlement
      ? "entitlements"
      : "default";
  const cycle = currentBudgetCycle(entitlement?.cycleAnchor ?? DEFAULT_BUDGET_CYCLE_ANCHOR, now);
  let spend: UsageCostSum;
  try {
    spend = await deps.sumCost({
      ownerId: args.ownerId,
      since: cycle.start,
      until: cycle.end,
      requireRpc: read.status !== "missing",
    });
  } catch {
    return unavailablePlanBudget(cycle);
  }
  if (spend.status !== "ok" || !Number.isFinite(spend.usd) || spend.usd < 0) {
    return unavailablePlanBudget(cycle);
  }

  return evaluatePlanBudget({
    plan,
    source,
    cycle,
    usedUsd: spend.usd,
    resetsRemaining: entitlement ? entitlement.resetsRemaining : null,
    resetVersion: entitlement?.resetVersion ?? null,
  });
}
