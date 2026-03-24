import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

/** Row shape from `rabbit_hole_sessions` for browse list. */
export type RabbitHoleBrowseSessionRow = {
  session_id: string;
  root_question: string;
  created_at: string | null | undefined;
  updated_at: string | null | undefined;
};

/** Row shape from `rabbit_hole_path_segments` for browse aggregation. */
export type RabbitHoleBrowsePathSegmentRow = {
  session_id: string;
  node_id: string;
  position: number;
  label?: string | null;
};

/** Row shape from `rabbit_hole_nodes` when loading root summaries for browse. */
export type RabbitHoleBrowseRootNodeRow = {
  session_id: string;
  node_id: string;
  key_takeaways: unknown;
};

/**
 * Pure merge of Supabase browse queries into session list metadata.
 * Keeps `getAllSessions` testable without mocking the client.
 */
export function mergeRabbitHoleBrowseMetadata(
  sessions: RabbitHoleBrowseSessionRow[],
  pathSegments: RabbitHoleBrowsePathSegmentRow[] | null | undefined,
  rootNodes: RabbitHoleBrowseRootNodeRow[] | null | undefined
): RabbitHoleSessionMetadata[] {
  const pathLengthBySession = new Map<string, number>();
  const rootNodeIdBySession = new Map<string, string>();
  const rootTitleBySession = new Map<string, string>();

  for (const seg of pathSegments ?? []) {
    pathLengthBySession.set(seg.session_id, (pathLengthBySession.get(seg.session_id) ?? 0) + 1);
    if (seg.position === 0 && typeof seg.node_id === "string") {
      rootNodeIdBySession.set(seg.session_id, seg.node_id);
      if (typeof seg.label === "string" && seg.label.length > 0) {
        rootTitleBySession.set(seg.session_id, seg.label);
      }
    }
  }

  const rootNodeIds = Array.from(rootNodeIdBySession.values());
  const summaryBySession = new Map<string, string>();

  if (rootNodeIds.length > 0) {
    for (const node of rootNodes ?? []) {
      if (rootNodeIdBySession.get(node.session_id) !== node.node_id) {
        continue;
      }
      const takeaways = Array.isArray(node.key_takeaways) ? (node.key_takeaways as string[]) : [];
      const summary = takeaways.length > 0 ? takeaways.slice(0, 2).join(" • ") : undefined;

      if (summary) summaryBySession.set(node.session_id, summary);
    }
  }

  return sessions.map((s) => {
    const createdAt = typeof s.created_at === "string" ? s.created_at : new Date().toISOString();
    const updatedAt = typeof s.updated_at === "string" ? s.updated_at : createdAt;

    return {
      sessionId: s.session_id,
      rootQuestion: s.root_question,
      rootTitle: rootTitleBySession.get(s.session_id),
      createdAt,
      updatedAt,
      pathLength: pathLengthBySession.get(s.session_id) ?? 0,
      summary: summaryBySession.get(s.session_id),
    };
  });
}
