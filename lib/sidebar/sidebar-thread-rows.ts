import { rabbitHoleDisplayTitle } from "@/data/supabase/rabbitHoleBrowseMetadata";

/** One sidebar row as the list endpoint returns it. Only what the sidebar renders. */
export type SidebarThreadRow = {
  id: string;
  title: string | null;
  updated_at: string;
  pinned: boolean | null;
  feature: string | null;
  path: string | null;
};

/** A row from the list query, with its rabbit hole embedded (empty for every other thread). */
export type SidebarThreadQueryRow = SidebarThreadRow & {
  rabbit_hole_sessions?:
    | {
        root_question: string | null;
        /** Filtered to the root segment (position 0) by the query. */
        rabbit_hole_path_segments?: { label: string | null }[] | null;
      }[]
    | null;
};

/**
 * Shapes the joined list query into sidebar rows:
 * - rabbit-hole threads take their rabbit hole's title (root article title, else root question);
 * - rabbit-hole threads no session links to are dropped (creation-race duplicates, or leftovers
 *   of deleted rabbit holes);
 * - the embed is stripped so the payload carries only what the sidebar renders.
 */
export function resolveSidebarThreadRows(
  rows: readonly SidebarThreadQueryRow[]
): SidebarThreadRow[] {
  const resolved: SidebarThreadRow[] = [];

  for (const { rabbit_hole_sessions: sessions, ...row } of rows) {
    if (row.feature !== "rabbit_hole") {
      resolved.push(row);
      continue;
    }

    const session = sessions?.[0];

    if (!session) continue;

    const title = rabbitHoleDisplayTitle({
      rootTitle: session.rabbit_hole_path_segments?.[0]?.label,
      rootQuestion: session.root_question,
    });

    resolved.push({ ...row, title: title ?? row.title });
  }

  return resolved;
}
