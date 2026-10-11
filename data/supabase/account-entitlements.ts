import "server-only";

import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { isPlanId } from "@/lib/plans/plan-tags";

/**
 * Plan and usage-reset credits (`docs/migrations/account_entitlements.sql`). Service role only:
 * these are authorization data, written by Organic or the owner, never by the user. Every read
 * distinguishes "not migrated yet" from a transient failure, so callers can fall back to
 * defaults in the first case and fail closed in the second.
 */

const logger = createLogger("data/supabase/account-entitlements.ts");

export type AccountEntitlement = {
  plan: string;
  resetsRemaining: number;
  cycleAnchor: Date;
  /** Preserve database precision for compare-and-set resets. */
  resetVersion: string;
};

export type EntitlementRead =
  | { status: "ok"; entitlement: AccountEntitlement }
  /** No row for this profile (should not happen once the trigger and backfill ran). */
  | { status: "absent" }
  | { status: "missing" }
  | { status: "error" };

function isMissingRelation(message: string, code?: string): boolean {
  return (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    ((message.includes("account_entitlements") || message.includes("consume_usage_reset")) &&
      (message.includes("does not exist") || message.includes("Could not find")))
  );
}

export async function readAccountEntitlement(profileId: string): Promise<EntitlementRead> {
  const { data, error } = await supabaseAdmin
    .from("account_entitlements")
    .select("plan, resets_remaining, cycle_anchor")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error.message, error.code)) return { status: "missing" };
    logger.warn("readAccountEntitlement", error.message);

    return { status: "error" };
  }
  if (!data) return { status: "absent" };

  const cycleAnchor = new Date(data.cycle_anchor as string);

  if (
    Number.isNaN(cycleAnchor.getTime()) ||
    !isPlanId(data.plan) ||
    !Number.isSafeInteger(data.resets_remaining) ||
    data.resets_remaining < 0
  )
    return { status: "error" };

  return {
    status: "ok",
    entitlement: {
      plan: String(data.plan),
      resetsRemaining: Math.max(0, Number(data.resets_remaining) || 0),
      cycleAnchor,
      resetVersion: data.cycle_anchor,
    },
  };
}

export type ConsumeResetResult =
  | { status: "ok"; resetsRemaining: number; cycleAnchor: Date }
  | { status: "conflict" }
  | { status: "unavailable" };

/** Spend one reset atomically: starts a fresh weekly window now. */
export async function consumeUsageReset(
  profileId: string,
  expectedAnchor: string
): Promise<ConsumeResetResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_usage_reset", {
    p_profile_id: profileId,
    p_expected_anchor: expectedAnchor,
  });

  if (error) {
    if (!isMissingRelation(error.message, error.code))
      logger.warn("consumeUsageReset", error.message);

    return { status: "unavailable" };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) return { status: "conflict" };

  return {
    status: "ok",
    resetsRemaining: Number(row.resets_remaining) || 0,
    cycleAnchor: new Date(row.cycle_anchor as string),
  };
}
