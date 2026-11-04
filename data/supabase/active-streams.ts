import "server-only";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/** A thread still marked as streaming: `threads.active_stream_id` is set. */
export type ActiveStreamMarker = {
  threadId: string;
  streamId: string;
  /** Last write to the thread row. Setting the marker is a write, so this is at least its start. */
  updatedAt: string;
};

/**
 * Stream markers on threads whose row has not changed since `idleBefore`, oldest first. Admin
 * client: the sweep runs from a cron job with no user, across every owner.
 */
export async function listIdleActiveStreams(
  idleBefore: Date,
  limit: number
): Promise<ActiveStreamMarker[]> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("id, active_stream_id, updated_at")
    .not("active_stream_id", "is", null)
    .lt("updated_at", idleBefore.toISOString())
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`listIdleActiveStreams: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    threadId: row.id as string,
    streamId: row.active_stream_id as string,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Clears a thread's stream marker only while it still names `streamId`, so a stream that began
 * after the sweep read the row keeps its marker. Returns whether the row changed.
 */
export async function clearActiveStreamIfUnchanged(
  threadId: string,
  streamId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .update({ active_stream_id: null })
    .eq("id", threadId)
    .eq("active_stream_id", streamId)
    .select("id");

  if (error) {
    throw new Error(`clearActiveStreamIfUnchanged: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}
