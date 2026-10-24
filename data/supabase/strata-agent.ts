"use server";

import { supabaseServer } from "@/lib/supabase/server";
import {
  getStrataAgentThreadId,
  strataAgentThreadPath,
  type StrataAgentThreadScope,
} from "@/lib/strata/strata-agent-thread";

/**
 * Ensures a threads row exists for the Strata hub or per-page assistant (deterministic id per owner + scope).
 */
export async function ensureStrataAgentThread(
  ownerId: string,
  scope: StrataAgentThreadScope
): Promise<string> {
  const id = getStrataAgentThreadId(ownerId, scope);
  const sb = (await supabaseServer()) as any;
  const path = strataAgentThreadPath(scope);
  const title = scope.kind === "hub" ? "Strata hub assistant" : "Strata page assistant";

  const { error } = await sb.from("threads").upsert(
    {
      id,
      owner_id: ownerId,
      feature: "strata_agent",
      path,
      title,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(error.message ?? "Failed to ensure Strata agent thread");
  }

  return id;
}
