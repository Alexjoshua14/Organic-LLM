"use server";

import { Result, SimpleResult } from "@/types";
import {
  RabbitHoleSession,
  RabbitHoleSessionSchema,
} from "@/lib/schemas/rabbitHoleSchemas";
import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";
import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("data/supabase/rabbitholes.ts");

const DEBUG_MODE = process.env.NODE_ENV === "development";

/**
 * Check if a string is a Unix timestamp (numeric string)
 */
function isUnixTimestamp(value: string): boolean {
  return /^\d+$/.test(value) && value.length >= 10;
}

/** Placeholder key_takeaways for stub/optimistic nodes (DB requires length >= 3). */
const STUB_NODE_KEY_TAKEAWAYS = ["Generating…", "…", "…"] as const;

/** Minimal node shape used when building DB rows (optimistic nodes may have keyTakeaways.length < 3). */
type NodeForRow = {
  id: string;
  rawPrompt: string;
  userQuestion: string;
  keyTakeaways: string[];
  articleHtml: string;
  createdAt: string;
};

/**
 * Map a session node to a rabbit_hole_nodes row for upsert.
 * Uses placeholder key_takeaways when the node has fewer than 3 (stub/optimistic nodes).
 * Exported for unit tests.
 */
export function nodeToRabbitHoleNodeRow(
  node: NodeForRow,
  sessionId: string,
): {
  session_id: string;
  node_id: string;
  raw_prompt: string;
  user_question: string;
  key_takeaways: string[];
  article_html: string;
  created_at: string;
} {
  const keyTakeaways =
    node.keyTakeaways.length >= 3
      ? node.keyTakeaways
      : node.keyTakeaways.length === 0
        ? [...STUB_NODE_KEY_TAKEAWAYS]
        : [...node.keyTakeaways, ...STUB_NODE_KEY_TAKEAWAYS].slice(0, 3);
  return {
    session_id: sessionId,
    node_id: node.id,
    raw_prompt: node.rawPrompt,
    user_question: node.userQuestion,
    key_takeaways: keyTakeaways,
    article_html: node.articleHtml,
    created_at: isUnixTimestamp(node.createdAt)
      ? new Date(Number(node.createdAt)).toISOString()
      : node.createdAt,
  };
}

/**
 * List session metadata (index view)
 */
export async function getAllSessions(): Promise<
  Result<RabbitHoleSessionMetadata[]>
> {
  const supabase = await supabaseServer();

  const { data: sessions, error: sessionsError } = await supabase
    .from("rabbit_hole_sessions")
    .select("session_id, root_question, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (sessionsError) {
    return {
      data: [],
      error: new Error(
        sessionsError?.message ?? "Error fetching sessions from Supabase",
      ),
    };
  }

  if (!sessions || sessions.length === 0) {
    return { data: [], error: null };
  }

  const sessionIds = sessions.map((s) => s.session_id);

  // Fetch path segments to compute pathLength and locate root node IDs.
  const { data: pathSegments, error: pathError } = await supabase
    .from("rabbit_hole_path_segments")
    .select("session_id, node_id, position")
    .in("session_id", sessionIds);

  if (pathError) {
    return {
      data: [],
      error: new Error(
        pathError?.message ??
          "Error fetching session path segments from Supabase",
      ),
    };
  }

  const pathLengthBySession = new Map<string, number>();
  const rootNodeIdBySession = new Map<string, string>();

  for (const seg of pathSegments ?? []) {
    pathLengthBySession.set(
      seg.session_id,
      (pathLengthBySession.get(seg.session_id) ?? 0) + 1,
    );
    if (seg.position === 0 && typeof seg.node_id === "string") {
      rootNodeIdBySession.set(seg.session_id, seg.node_id);
    }
  }

  // Fetch root nodes to compute a short summary (first 2 takeaways).
  const rootNodeIds = Array.from(rootNodeIdBySession.values());
  const summaryBySession = new Map<string, string>();

  if (rootNodeIds.length > 0) {
    const { data: rootNodes, error: rootNodesError } = await supabase
      .from("rabbit_hole_nodes")
      .select("session_id, node_id, key_takeaways")
      .in("session_id", sessionIds)
      .in("node_id", rootNodeIds);

    if (rootNodesError) {
      return {
        data: [],
        error: new Error(
          rootNodesError?.message ??
            "Error fetching root nodes from Supabase for session summaries",
        ),
      };
    }

    for (const node of rootNodes ?? []) {
      const takeaways = Array.isArray(node.key_takeaways)
        ? (node.key_takeaways as string[])
        : [];
      const summary =
        takeaways.length > 0 ? takeaways.slice(0, 2).join(" • ") : undefined;
      if (summary) summaryBySession.set(node.session_id, summary);
    }
  }

  const metadata: RabbitHoleSessionMetadata[] = sessions.map((s) => {
    const createdAt =
      typeof s.created_at === "string"
        ? s.created_at
        : new Date().toISOString();
    const updatedAt =
      typeof s.updated_at === "string" ? s.updated_at : createdAt;

    return {
      sessionId: s.session_id,
      rootQuestion: s.root_question,
      createdAt,
      updatedAt,
      pathLength: pathLengthBySession.get(s.session_id) ?? 0,
      summary: summaryBySession.get(s.session_id),
    };
  });

  return {
    data: metadata,
    error: null,
  };
}

/**
 * Fetch a full session by ID
 */
export async function getSessionById(
  sessionId: string,
): Promise<Result<RabbitHoleSession | null>> {
  const supabase = await supabaseServer();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("rabbit_hole_sessions")
    .select("session_id, root_question, active_node_id, created_at, updated_at")
    .eq("session_id", sessionId)
    .single();

  if (sessionError) {
    return {
      data: null,
      error: new Error(
        sessionError?.message ?? "Error fetching session from Supabase",
      ),
    };
  }

  if (!sessionRow) {
    return { data: null, error: null };
  }

  // Fetch all related entities for the session.
  const [pathRes, nodesRes, edgesRes, sourcesRes, branchesRes] =
    await Promise.all([
      supabase
        .from("rabbit_hole_path_segments")
        .select("node_id, label, parent_node_id, position")
        .eq("session_id", sessionId)
        .order("position", { ascending: true }),
      supabase
        .from("rabbit_hole_nodes")
        .select(
          "node_id, raw_prompt, user_question, key_takeaways, article_html, created_at",
        )
        .eq("session_id", sessionId),
      supabase
        .from("rabbit_hole_edges")
        .select("from_node_id, to_node_id, edge_type")
        .eq("session_id", sessionId),
      supabase
        .from("rabbit_hole_sources")
        .select(
          "node_id, source_id, title, url, favicon_url, snippet, published_date, author, highlights, analysis",
        )
        .eq("session_id", sessionId),
      supabase
        .from("rabbit_hole_branch_suggestions")
        .select("node_id, branch_id, label, short_description")
        .eq("session_id", sessionId),
    ]);

  const firstError =
    pathRes.error ||
    nodesRes.error ||
    edgesRes.error ||
    sourcesRes.error ||
    branchesRes.error;

  if (firstError) {
    return {
      data: null,
      error: new Error(
        firstError.message ?? "Error fetching session details from Supabase",
      ),
    };
  }

  const path = (pathRes.data ?? []).map((seg) => ({
    nodeId: seg.node_id,
    label: seg.label,
    parentNodeId: seg.parent_node_id ?? null,
  }));

  const rootNodeId = path[0]?.nodeId ?? null;

  // Sources grouped by node
  const sourcesByNodeId = new Map<string, any[]>();
  for (const s of sourcesRes.data ?? []) {
    const arr = sourcesByNodeId.get(s.node_id) ?? [];
    arr.push({
      status: "none",
      id: s.source_id,
      title: s.title,
      url: s.url,
      faviconUrl: s.favicon_url ?? null,
      snippet: s.snippet ?? null,
      publishedDate: s.published_date ?? null,
      author: s.author ?? null,
      highlights: s.highlights ?? undefined,
      analysis: s.analysis ?? undefined,
    });
    sourcesByNodeId.set(s.node_id, arr);
  }

  // Branch suggestions grouped by node
  const branchesByNodeId = new Map<string, any[]>();
  for (const b of branchesRes.data ?? []) {
    const arr = branchesByNodeId.get(b.node_id) ?? [];
    arr.push({
      id: b.branch_id,
      label: b.label,
      shortDescription: b.short_description ?? undefined,
    });
    branchesByNodeId.set(b.node_id, arr);
  }

  const nodesById: RabbitHoleSession["nodesById"] = {};
  for (const node of nodesRes.data ?? []) {
    nodesById[node.node_id] = {
      id: node.node_id,
      rawPrompt: node.raw_prompt,
      userQuestion: node.user_question,
      refinedQuestion: null,
      preview: null,
      keyTakeaways: Array.isArray(node.key_takeaways)
        ? (node.key_takeaways as string[])
        : [],
      articleHtml: node.article_html,
      sources: sourcesByNodeId.get(node.node_id) ?? [],
      branchSuggestions: branchesByNodeId.get(node.node_id) ?? [],
      createdAt:
        typeof node.created_at === "string"
          ? node.created_at
          : new Date().toISOString(),
    };
  }

  const edges = (edgesRes.data ?? []).map((e) => ({
    from: e.from_node_id,
    to: e.to_node_id,
    type: e.edge_type ?? undefined,
  }));

  const assembled: RabbitHoleSession = {
    sessionId: sessionRow.session_id,
    rootQuestion: sessionRow.root_question,
    rootNodeId,
    path,
    nodesById,
    activeNodeId: sessionRow.active_node_id ?? rootNodeId,
    edges,
    createdAt:
      typeof sessionRow.created_at === "string"
        ? sessionRow.created_at
        : new Date().toISOString(),
    updatedAt:
      typeof sessionRow.updated_at === "string"
        ? sessionRow.updated_at
        : undefined,
  };

  const validated = RabbitHoleSessionSchema.safeParse(assembled);
  if (!validated.success) {
    if (DEBUG_MODE) {
      logger.error(
        "getSessionById",
        `Failed to validate assembled session: ${validated.error.message}`,
      );
    }
    return {
      data: null,
      error: new Error(
        validated.error.message ?? "Error validating assembled session",
      ),
    };
  }

  return {
    data: validated.data,
    error: null,
  };
}

async function deserializeSession(
  serialized: string,
): Promise<RabbitHoleSession> {
  // PArse using Zod
  const parsed = RabbitHoleSessionSchema.safeParse(JSON.parse(serialized));
  if (!parsed.success) {
    logger.error(
      "deserializeSession",
      `Failed to deserialize session: ${parsed.error.message}`,
    );
    throw new Error(`Failed to deserialize session: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Persist a session (upsert)
 */
export async function saveSession(serialized: string): Promise<SimpleResult> {
  const supabase = await supabaseServer();

  try {
    if (DEBUG_MODE) {
      logger.log(
        "saveSession",
        `Starting save operation. Serialized length: ${serialized.length} chars`,
      );
    }

    if (DEBUG_MODE) {
      logger.log(
        "saveSession",
        `Deserializing session: ${serialized.substring(0, 100)}...`,
      );
    }
    const session = await deserializeSession(serialized);

    if (DEBUG_MODE) {
      logger.log(
        "saveSession",
        `Deserialized session ${session.sessionId} with ${Object.keys(session.nodesById).length} nodes, ${session.path.length} path segments`,
      );
    }

    // Upsert the main session
    if (DEBUG_MODE) {
      logger.log("saveSession", `Upserting main session: ${session.sessionId}`);
    }

    // Convert timestamps to ISO strings if they're Unix timestamps
    const createdAt = isUnixTimestamp(session.createdAt)
      ? new Date(Number(session.createdAt)).toISOString()
      : session.createdAt;
    const updatedAt = session.updatedAt
      ? isUnixTimestamp(session.updatedAt)
        ? new Date(Number(session.updatedAt)).toISOString()
        : session.updatedAt
      : new Date().toISOString();

    const { error: sessionError } = await supabase
      .from("rabbit_hole_sessions")
      .upsert(
        {
          session_id: session.sessionId,
          root_question: session.rootQuestion,
          active_node_id: session.activeNodeId,
          created_at: createdAt,
          updated_at: updatedAt,
        },
        {
          onConflict: "session_id",
        },
      );

    if (sessionError) {
      logger.error(
        "saveSession",
        `Failed to upsert session: ${sessionError.message}`,
      );
      return {
        ok: false,
        error: new Error(`Failed to save session: ${sessionError.message}`),
      };
    }
    if (DEBUG_MODE) {
      logger.log("saveSession", `Successfully upserted main session`);
    }

    // Upsert nodes (unique on session_id + node_id)
    const nodes = Object.values(session.nodesById).map((node) =>
      nodeToRabbitHoleNodeRow(node, session.sessionId),
    );

    if (nodes.length > 0) {
      if (DEBUG_MODE) {
        logger.log("saveSession", `Upserting ${nodes.length} nodes`);
      }
      const { error: nodesError } = await supabase
        .from("rabbit_hole_nodes")
        .upsert(nodes, { onConflict: "session_id,node_id" });

      if (nodesError) {
        logger.error(
          "saveSession",
          `Failed to upsert nodes: ${nodesError.message}`,
        );
        return {
          ok: false,
          error: new Error(`Failed to save nodes: ${nodesError.message}`),
        };
      }
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Successfully upserted ${nodes.length} nodes`,
        );
      }
    } else {
      if (DEBUG_MODE) {
        logger.log("saveSession", "No nodes to upsert");
      }
    }

    // Upsert path segments (unique on session_id + node_id + position)
    const pathSegments = session.path.map((seg, index) => ({
      session_id: session.sessionId,
      node_id: seg.nodeId,
      label: seg.label,
      parent_node_id: seg.parentNodeId,
      position: index,
    }));

    if (pathSegments.length > 0) {
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Upserting ${pathSegments.length} path segments`,
        );
      }
      const { error: pathError } = await supabase
        .from("rabbit_hole_path_segments")
        .upsert(pathSegments, { onConflict: "session_id,node_id,position" });

      if (pathError) {
        logger.error(
          "saveSession",
          `Failed to upsert path segments: ${pathError.message}`,
        );
        return {
          ok: false,
          error: new Error(
            `Failed to save path segments: ${pathError.message}`,
          ),
        };
      }
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Successfully upserted ${pathSegments.length} path segments`,
        );
      }
    } else {
      if (DEBUG_MODE) {
        logger.log("saveSession", "No path segments to upsert");
      }
    }

    // Upsert edges (unique on session_id + from_node_id + to_node_id)
    if (session.edges && session.edges.length > 0) {
      const edges = session.edges.map((edge) => ({
        session_id: session.sessionId,
        from_node_id: edge.from,
        to_node_id: edge.to,
        edge_type: edge.type || null,
      }));

      if (DEBUG_MODE) {
        logger.log("saveSession", `Upserting ${edges.length} edges`);
      }
      const { error: edgesError } = await supabase
        .from("rabbit_hole_edges")
        .upsert(edges, { onConflict: "session_id,from_node_id,to_node_id" });

      if (edgesError) {
        logger.error(
          "saveSession",
          `Failed to upsert edges: ${edgesError.message}`,
        );
        return {
          ok: false,
          error: new Error(`Failed to save edges: ${edgesError.message}`),
        };
      }
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Successfully upserted ${edges.length} edges`,
        );
      }
    } else {
      if (DEBUG_MODE) {
        logger.log("saveSession", "No edges to upsert");
      }
    }

    // Upsert sources (unique on session_id + node_id + source_id)
    const sources = [];
    for (const node of Object.values(session.nodesById)) {
      if (node.sources && node.sources.length > 0) {
        for (const source of node.sources) {
          sources.push({
            session_id: session.sessionId,
            node_id: node.id,
            source_id: source.id,
            title: source.title,
            url: source.url,
            favicon_url: source.faviconUrl || null,
            snippet: source.snippet || null,
            published_date: source.publishedDate || null,
            author: source.author || null,
            highlights: source.highlights || null,
            analysis: source.analysis
              ? JSON.parse(JSON.stringify(source.analysis))
              : null,
          });
        }
      }
    }

    if (sources.length > 0) {
      if (DEBUG_MODE) {
        logger.log("saveSession", `Upserting ${sources.length} sources`);
      }
      const { error: sourcesError } = await supabase
        .from("rabbit_hole_sources")
        .upsert(sources, { onConflict: "session_id,node_id,source_id" });

      if (sourcesError) {
        logger.error(
          "saveSession",
          `Failed to upsert sources: ${sourcesError.message}`,
        );
        return {
          ok: false,
          error: new Error(`Failed to save sources: ${sourcesError.message}`),
        };
      }
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Successfully upserted ${sources.length} sources`,
        );
      }
    } else {
      if (DEBUG_MODE) {
        logger.log("saveSession", "No sources to upsert");
      }
    }

    // Upsert branch suggestions (unique on session_id + node_id + branch_id)
    const branchSuggestions = [];
    for (const node of Object.values(session.nodesById)) {
      if (node.branchSuggestions && node.branchSuggestions.length > 0) {
        for (const branch of node.branchSuggestions) {
          branchSuggestions.push({
            session_id: session.sessionId,
            node_id: node.id,
            branch_id: branch.id,
            label: branch.label,
            short_description: branch.shortDescription || null,
          });
        }
      }
    }

    if (branchSuggestions.length > 0) {
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Upserting ${branchSuggestions.length} branch suggestions`,
        );
      }
      const { error: branchesError } = await supabase
        .from("rabbit_hole_branch_suggestions")
        .upsert(branchSuggestions, {
          onConflict: "session_id,node_id,branch_id",
        });

      if (branchesError) {
        logger.error(
          "saveSession",
          `Failed to upsert branch suggestions: ${branchesError.message}`,
        );
        return {
          ok: false,
          error: new Error(
            `Failed to save branch suggestions: ${branchesError.message}`,
          ),
        };
      }
      if (DEBUG_MODE) {
        logger.log(
          "saveSession",
          `Successfully upserted ${branchSuggestions.length} branch suggestions`,
        );
      }
    } else {
      if (DEBUG_MODE) {
        logger.log("saveSession", "No branch suggestions to upsert");
      }
    }

    if (DEBUG_MODE) {
      logger.log(
        "saveSession",
        `Successfully saved session ${session.sessionId}`,
      );
    }
    return {
      ok: true,
      error: null,
    };
  } catch (error) {
    logger.error(
      "saveSession",
      `Unexpected error saving session: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      ok: false,
      error:
        error instanceof Error
          ? error
          : new Error("Unknown error saving session"),
    };
  }
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<SimpleResult> {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("rabbit_hole_sessions")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    return {
      ok: false,
      error: new Error(
        error?.message ?? "Error deleting session from Supabase",
      ),
    };
  }

  return {
    ok: true,
    error: null,
  };
}
