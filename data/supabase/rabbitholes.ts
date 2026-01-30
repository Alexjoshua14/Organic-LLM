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

const DEBUG_MODE = true;

/**
 * Check if a string is a Unix timestamp (numeric string)
 */
function isUnixTimestamp(value: string): boolean {
  return /^\d+$/.test(value) && value.length >= 10;
}

/**
 * List session metadata (index view)
 */
export async function getAllSessions(): Promise<
  Result<RabbitHoleSessionMetadata[]>
> {
  return {
    data: [],
    error: new Error("Not yet implemented"),
  };
}

/**
 * Fetch a full session by ID
 */
export async function getSessionById(
  sessionId: string,
): Promise<Result<RabbitHoleSession | null>> {
  logger.log("getSessionById", `Not yet implemented`);
  return {
    data: null,
    error: new Error("Not yet implemented"),
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
      .upsert({
        session_id: session.sessionId,
        root_question: session.rootQuestion,
        active_node_id: session.activeNodeId,
        created_at: createdAt,
        updated_at: updatedAt,
      });

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
    const nodes = Object.values(session.nodesById).map((node) => ({
      session_id: session.sessionId,
      node_id: node.id,
      raw_prompt: node.rawPrompt,
      user_question: node.userQuestion,
      key_takeaways: node.keyTakeaways,
      article_html: node.articleHtml,
      created_at: isUnixTimestamp(node.createdAt)
        ? new Date(Number(node.createdAt)).toISOString()
        : node.createdAt,
    }));

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
export async function deleteSession(sessionId: string): Promise<Result<void>> {
  return {
    data: null,
    error: new Error("Not yet implemented"),
  };
}
