import "server-only";

import type { TokenBucket } from "@/lib/usage/token-analytics";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/** Page grouped results too: PostgREST's row limit also applies to RPC results. */
export async function readTokenAnalytics(
  owner: string,
  start: string,
  end: string
): Promise<TokenBucket[]> {
  const rows: TokenBucket[] = [];

  for (let offset = 0; offset < 100_000; offset += 1000) {
    const { data, error } = await supabaseAdmin
      .rpc("admin_token_analytics", {
        p_owner: owner,
        p_since: start,
        p_until: end,
      })
      .range(offset, offset + 999);

    if (error) throw new Error("Token aggregation failed");
    for (const row of data ?? []) {
      const normalized = { ...row };

      for (const key of ["input", "cached", "uncached", "unknown", "output", "calls"] as const) {
        normalized[key] = Number(row[key]);
        if (!Number.isSafeInteger(normalized[key]) || normalized[key] < 0)
          throw new Error("Invalid token aggregate");
      }
      rows.push(normalized);
    }
    if ((data?.length ?? 0) < 1000) return rows;
  }
  throw new Error("Analytics range too large");
}
