import "server-only";

import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

import { hasAgentAccounts } from "@/lib/agent-account/agent-account";
import {
  readAccountEntitlement,
  readClerkUserIdForProfile,
  type EntitlementRead,
} from "@/data/supabase/account-entitlements";
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
  /** Only called when agent accounts are configured and the caller passed no Clerk id. */
  clerkUserIdForProfile(profileId: string): Promise<string | null>;
  /** Raw agent allowlist; tests pass it, production reads the env. */
  agentEnvRaw?: string;
};

const defaultDeps: PlanBudgetDeps = {
  readEntitlement: readAccountEntitlement,
  sumCost: sumLlmUsageCostUsd,
  clerkUserIdForProfile: readClerkUserIdForProfile,
};

/**
 * The user's plan budget for the current weekly window: verified plan, spend so far, reset
 * credits, and whether new LLM requests may run.
 *
 * - Entitlements not migrated → free plan on the default Monday window, resets unavailable.
 * - Entitlement or spend unreadable → blocked until it recovers. Never authorize on stale spend.
 * - Agent test account → the hidden `agent` plan with no resets. Background callers that pass
 *   only `ownerId` get the Clerk id looked up whenever agent accounts are configured, so an
 *   agent's background work cannot fall through to `free`; an unreadable id blocks.
 */
export async function getPlanBudgetForUser(
  args: { clerkUserId?: string; ownerId: string; now?: Date },
  deps: PlanBudgetDeps = defaultDeps
): Promise<PlanBudgetSnapshot> {
  const now = args.now ?? new Date();
  let read: EntitlementRead;
  let clerkUserId = args.clerkUserId ?? "";

  try {
    if (!clerkUserId && hasAgentAccounts(deps.agentEnvRaw)) {
      clerkUserId = (await deps.clerkUserIdForProfile(args.ownerId)) ?? "";
    }
    read = await deps.readEntitlement(args.ownerId);
  } catch {
    return unavailablePlanBudget(currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR, now));
  }

  if (read.status === "error") {
    return unavailablePlanBudget(currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR, now));
  }

  const entitlement = read.status === "ok" ? read.entitlement : null;
  const plan = resolvePlan({
    clerkUserId,
    storedPlan: entitlement?.plan,
    agentEnvRaw: deps.agentEnvRaw,
  });
  const source =
    plan === "agent" || parseMaxPlanClerkUserIds().has(clerkUserId)
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
    // The agent plan never starts a fresh window early, whatever its entitlement row holds.
    resetsRemaining: plan === "agent" ? 0 : entitlement ? entitlement.resetsRemaining : null,
    resetVersion: entitlement?.resetVersion ?? null,
  });
}
