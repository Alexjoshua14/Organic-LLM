import "server-only";

import type { Result } from "@/types";

import {
  resolveSidebarThreadRows,
  type SidebarThreadQueryRow,
  type SidebarThreadRow,
} from "@/lib/sidebar/sidebar-thread-rows";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The sidebar thread list in one query: the owner's non-archived threads, newest first, each with
 * its rabbit hole (via `rabbit_hole_sessions.chat_thread_id`) and that rabbit hole's root path
 * segment embedded. Replaces a thread query plus two rabbit-hole lookups. Archived threads are
 * never read (`idx_threads_owner_updated_unarchived` matches the predicate).
 *
 * Deliberately separate from `getChats`, whose other callers (tools, sync, Remy) want every thread.
 */
export async function getSidebarThreads(ownerId: string): Promise<Result<SidebarThreadRow[]>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select(
      "id, title, updated_at, pinned, feature, path, rabbit_hole_sessions(root_question, rabbit_hole_path_segments(label))"
    )
    .eq("owner_id", ownerId)
    .not("archived", "is", true)
    .eq("rabbit_hole_sessions.rabbit_hole_path_segments.position", 0)
    .order("updated_at", { ascending: false });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: resolveSidebarThreadRows((data ?? []) as SidebarThreadQueryRow[]), error: null };
}
