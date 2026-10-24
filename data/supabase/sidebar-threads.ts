import "server-only";

import type { Result } from "@/types";

import {
  SIDEBAR_PINNED_MAX,
  sidebarCursorFilter,
  sidebarFeatureCondition,
  toSidebarPage,
  type SidebarCursor,
  type SidebarThreadRow,
  type SidebarThreadScope,
  type SidebarThreadsPage,
} from "@/lib/chat/sidebar-threads";
import { supabaseServer } from "@/lib/supabase/server";

/*
 * Not in chat.ts: that file is "use server", so every export there is a
 * client-callable action. This one takes an owner id and stays route-only.
 */

const SIDEBAR_THREAD_COLUMNS = "id, title, owner_id, created_at, updated_at, pinned, feature, path";

/**
 * One page of the sidebar list for an owner, newest first, keyset-paged on
 * `(updated_at, id)`. Unpinned rows only; the first page (no cursor) also returns every
 * pinned thread, fetched in parallel. Feature filtering happens here so hidden threads
 * never leave the database.
 *
 * Needs `threads (owner_id, updated_at desc, id desc)` to stay an index range scan;
 * see docs/migrations/threads_sidebar_list_index.sql.
 */
export async function getSidebarThreadsPage(options: {
  ownerId: string;
  scope: SidebarThreadScope;
  cursor: SidebarCursor | null;
  limit: number;
}): Promise<Result<SidebarThreadsPage>> {
  const { ownerId, scope, cursor, limit } = options;
  const sb = await supabaseServer();
  const feature = sidebarFeatureCondition(scope);

  let pageQuery = sb
    .from("threads")
    .select(SIDEBAR_THREAD_COLUMNS)
    .eq("owner_id", ownerId)
    .not("pinned", "is", true)
    .filter("feature", feature.op, feature.value);

  if (cursor) pageQuery = pageQuery.or(sidebarCursorFilter(cursor));

  const pagePromise = pageQuery
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  const pinnedPromise = cursor
    ? null
    : sb
        .from("threads")
        .select(SIDEBAR_THREAD_COLUMNS)
        .eq("owner_id", ownerId)
        .eq("pinned", true)
        .filter("feature", feature.op, feature.value)
        .order("updated_at", { ascending: false })
        .limit(SIDEBAR_PINNED_MAX);

  const [pageResult, pinnedResult] = await Promise.all([pagePromise, pinnedPromise]);
  const error = pageResult.error ?? pinnedResult?.error;

  if (error) {
    return { data: null, error: new Error(error.message ?? "Unknown error") };
  }

  return {
    data: toSidebarPage(
      (pageResult.data ?? []) as SidebarThreadRow[],
      limit,
      pinnedResult ? ((pinnedResult.data ?? []) as SidebarThreadRow[]) : undefined
    ),
    error: null,
  };
}
