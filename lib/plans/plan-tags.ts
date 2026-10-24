import type { UsagePlanTierId } from "@/lib/usage/plans";

import { getUsagePlanTier } from "@/lib/usage/plans";

/**
 * Plan budget gating. A user's plan comes from `account_entitlements` (verified server-side,
 * never user-editable). Every LLM request that spends tokens checks the current weekly budget
 * cycle against the plan's cap; at the cap, new requests stop until the window resets or the
 * user spends a reset.
 */

export const PLAN_IDS = [
  "free",
  "plus",
  "pro",
  "max",
] as const satisfies readonly UsagePlanTierId[];
export type PlanId = UsagePlanTierId;

/**
 * Break-glass only: comma-separated Clerk user ids forced to `max`, overriding the entitlements
 * table. Leave unset in normal operation — assign plans with scripts/set-plan.ts. Never put
 * personal names or emails in source.
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

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** The stored plan, unless the break-glass allowlist forces `max`. Unknown values read as free. */
export function resolvePlan(args: {
  clerkUserId: string;
  storedPlan: string | null | undefined;
  envRaw?: string;
}): PlanId {
  if (parseMaxPlanClerkUserIds(args.envRaw).has(args.clerkUserId)) return "max";

  return isPlanId(args.storedPlan) ? args.storedPlan : "free";
}

export type PlanBudgetSnapshot = {
  status: "available" | "unavailable";
  plan: PlanId;
  /** Where the plan came from: the entitlements table, defaults (table not migrated), or the override. */
  source: "entitlements" | "default" | "override";
  /** Current weekly window, ISO. */
  cycleStart: string;
  cycleEnd: string;
  /** Null when the plan is uncapped (`max`). */
  capUsd: number | null;
  usedUsd: number;
  remainingUsd: number | null;
  /** Null when resets are unavailable (entitlements not migrated). */
  resetsRemaining: number | null;
  /** Opaque window version, used only to prevent duplicate reset consumption. */
  resetVersion: string | null;
  /** True when new LLM requests are allowed under this plan's budget. */
  canDispatch: boolean;
  /** User-facing reason when canDispatch is false. */
  holdReason: string | null;
};

export function evaluatePlanBudget(args: {
  plan: PlanId;
  source: PlanBudgetSnapshot["source"];
  cycle: { start: Date; end: Date };
  usedUsd: number;
  resetsRemaining: number | null;
  resetVersion?: string | null;
}): PlanBudgetSnapshot {
  const tier = getUsagePlanTier(args.plan);
  const used = Math.max(0, args.usedUsd);
  const cap = tier.costCapUsd;
  const canDispatch = cap === null || used < cap;

  return {
    status: "available",
    plan: args.plan,
    source: args.source,
    cycleStart: args.cycle.start.toISOString(),
    cycleEnd: args.cycle.end.toISOString(),
    capUsd: cap,
    usedUsd: used,
    remainingUsd: cap === null ? null : Math.max(0, cap - used),
    resetsRemaining: args.resetsRemaining,
    resetVersion: args.resetVersion ?? null,
    canDispatch,
    holdReason: canDispatch
      ? null
      : `You've used this week's ${tier.name} plan allowance ($${cap!.toFixed(0)}).`,
  };
}

/** Snapshot that blocks everything — used when spend cannot be read (fail closed). */
export function unavailablePlanBudget(cycle: { start: Date; end: Date }): PlanBudgetSnapshot {
  return {
    status: "unavailable",
    plan: "free",
    source: "default",
    cycleStart: cycle.start.toISOString(),
    cycleEnd: cycle.end.toISOString(),
    capUsd: null,
    usedUsd: 0,
    remainingUsd: null,
    resetsRemaining: null,
    resetVersion: null,
    canDispatch: false,
    holdReason: "Usage limits can't be checked right now. Try again in a moment.",
  };
}
