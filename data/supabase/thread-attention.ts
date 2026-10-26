import "server-only";

import type { SidebarThreadActivity } from "@/lib/sidebar/session-signal";
import type { Result, SimpleResult } from "@/types";

import { createLogger } from "@/lib/logger";
import { isRabbitHoleStep } from "@/lib/sidebar/session-signal";
import { supabaseServer } from "@/lib/supabase/server";

const logger = createLogger("data/supabase/thread-attention.ts");

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;

/** Row from the `sidebar_thread_attention` SQL function. */
type AttentionFunctionRow = {
  thread_id: string;
  unseen: boolean;
  working: boolean;
  generation_step: string | null;
};

/** After a "function not found", skip the RPC this long before trying it again. */
const RPC_RETRY_AFTER_MS = 5 * 60_000;

let rpcUnavailableUntil = 0;

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/**
 * Sidebar attention for one owner: threads with unseen content, threads streaming a reply, and
 * rabbit holes generating a node. Rows that are none of these are omitted — the client treats a
 * missing row as idle, which keeps the poll payload to a handful of rows.
 *
 * One round trip: the `sidebar_thread_attention` SQL function
 * (docs/migrations/thread_attention_table.sql). Until that migration is applied, falls back to
 * three parallel table queries, and remembers the function is missing so polls do not keep
 * paying for a failed call.
 *
 * Working markers older than `staleAfterMs` are ignored so an abandoned stream cannot read as
 * working forever. Decision: docs/architecture/decisions/20260924-sidebar-seen-state.md.
 */
export async function getThreadAttention(params: {
  ownerId: string;
  staleAfterMs: number;
}): Promise<Result<SidebarThreadActivity[]>> {
  const { ownerId, staleAfterMs } = params;
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const sb = await supabaseServer();

  if (Date.now() >= rpcUnavailableUntil) {
    const { data, error } = await sb.rpc("sidebar_thread_attention", {
      p_owner_id: ownerId,
      p_since: cutoff,
    });

    if (!error) {
      return {
        data: ((data ?? []) as AttentionFunctionRow[]).map((row) => ({
          id: String(row.thread_id),
          unseen: row.unseen === true,
          working: row.working
            ? { step: isRabbitHoleStep(row.generation_step) ? row.generation_step : null }
            : null,
        })),
        error: null,
      };
    }

    if (isMissingFunction(error)) {
      rpcUnavailableUntil = Date.now() + RPC_RETRY_AFTER_MS;
      logger.warn("getThreadAttention", "sidebar_thread_attention missing; using table queries");
    } else {
      logger.warn("getThreadAttention", "sidebar_thread_attention failed", { err: error.message });
    }
  }

  return getThreadAttentionFromTables(sb, ownerId, cutoff);
}

/** Tests only: forget that the SQL function was missing. */
export function resetThreadAttentionRpcState(): void {
  rpcUnavailableUntil = 0;
}

/**
 * Pre-migration path: three parallel queries. Each source degrades on its own — if one fails
 * (e.g. `thread_attention` not migrated yet) the others still report; only all three failing is
 * an error.
 */
async function getThreadAttentionFromTables(
  sb: SupabaseServerClient,
  ownerId: string,
  cutoff: string
): Promise<Result<SidebarThreadActivity[]>> {
  const [unseenRes, streamingRes, generatingRes] = await Promise.all([
    sb.from("thread_attention").select("thread_id").eq("owner_id", ownerId).eq("unseen", true),
    sb.from("threads").select("id").eq("owner_id", ownerId).gt("active_stream_started_at", cutoff),
    sb
      .from("rabbit_hole_sessions")
      .select("chat_thread_id, generation_step")
      .eq("owner_id", ownerId)
      .not("generating_node_id", "is", null)
      .not("chat_thread_id", "is", null)
      .gt("updated_at", cutoff),
  ]);

  const sources = { unseen: unseenRes, streaming: streamingRes, generating: generatingRes };
  const failed = Object.entries(sources).filter(([, res]) => res.error);

  for (const [name, res] of failed) {
    logger.warn("getThreadAttention", `${name} lookup failed`, { err: res.error?.message });
  }

  if (failed.length === Object.keys(sources).length) {
    return { data: null, error: new Error(unseenRes.error?.message ?? "Attention lookup failed") };
  }

  const byId = new Map<string, SidebarThreadActivity>();
  const entry = (id: string) => {
    let row = byId.get(id);

    if (!row) {
      row = { id, unseen: false, working: null };
      byId.set(id, row);
    }

    return row;
  };

  for (const row of unseenRes.error ? [] : (unseenRes.data ?? [])) {
    entry(String(row.thread_id)).unseen = true;
  }

  for (const row of streamingRes.error ? [] : (streamingRes.data ?? [])) {
    entry(String(row.id)).working = { step: null };
  }

  for (const row of generatingRes.error ? [] : (generatingRes.data ?? [])) {
    entry(String(row.chat_thread_id)).working = {
      step: isRabbitHoleStep(row.generation_step) ? row.generation_step : null,
    };
  }

  return { data: [...byId.values()], error: null };
}

/**
 * Records that the owner has seen the thread now. Writes `thread_attention`, never `threads`, so
 * the sidebar order (by `threads.updated_at`) does not change. RLS also checks the thread is the
 * caller's; the explicit owner is defense in depth.
 */
export async function markThreadSeen(params: {
  threadId: string;
  ownerId: string;
}): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { error } = await sb.from("thread_attention").upsert(
    {
      thread_id: params.threadId,
      owner_id: params.ownerId,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "thread_id" }
  );

  if (error) {
    return { ok: false, error: new Error(error.message) };
  }

  return { ok: true, error: null };
}
