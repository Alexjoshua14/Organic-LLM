import "server-only";

import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const logger = createLogger("data/supabase/usage-ledger.ts");

/** Original provider charges and separate signed corrections; neither can be overwritten. */
export async function readUsageLedger(ownerId: string, offset: number) {
  const [charges, adjustments] = await Promise.all([
    supabaseAdmin
      .from("llm_usage_events")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 99),
    supabaseAdmin
      .from("llm_usage_adjustments")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 99),
  ]);
  if (charges.error || adjustments.error) throw new Error("Usage ledger unavailable");

  return {
    charges: charges.data ?? [],
    adjustments: adjustments.data ?? [],
    offset,
    pageSize: 100,
  };
}

export type UsageAdjustmentInput = {
  id: string;
  ownerId: string;
  eventId: string | null;
  deltaUsd: number;
  reason: string;
  actorId: string;
};

export async function appendUsageAdjustment(input: UsageAdjustmentInput) {
  const { data, error } = await supabaseAdmin.rpc("append_llm_usage_adjustment", {
    p_id: input.id,
    p_owner: input.ownerId,
    p_event_id: input.eventId,
    p_delta: input.deltaUsd,
    p_reason: input.reason,
    p_actor: input.actorId,
  });
  logger.log("appendUsageAdjustment", "Ledger adjustment", {
    id: input.id,
    ownerId: input.ownerId,
    actorId: input.actorId,
    outcome: error ? "denied-or-unavailable" : data?.length ? "recorded" : "conflict",
  });
  if (error) throw new Error("Adjustment could not be recorded");
  return data?.[0] ?? null;
}
