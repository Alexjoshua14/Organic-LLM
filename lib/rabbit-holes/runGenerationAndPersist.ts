import {
  getSessionById,
  saveSession,
  type RabbitHolesSupabaseClient,
} from "@/data/supabase/rabbitholes";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import { generateRabbitHoleNode } from "./actions";

const logger = createLogger("lib/rabbit-holes/runGenerationAndPersist");

/**
 * Clears generating_node_id for a session (e.g. on early exit or error).
 * Used so the client stops polling. Pass client when running in background (e.g. after())
 * so we don't rely on the user's JWT which may be expired.
 */
export async function clearGeneratingNodeId(
  sessionId: string,
  client?: RabbitHolesSupabaseClient,
): Promise<void> {
  const supabase = client ?? (await supabaseServer());
  const { error } = await supabase
    .from("rabbit_hole_sessions")
    .update({ generating_node_id: null })
    .eq("session_id", sessionId);

  if (error) {
    logger.error(
      "clearGeneratingNodeId",
      `Failed to clear generating_node_id: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Loads session, runs node generation, and either persists the updated session
 * (with generatingNodeId cleared) or clears generating_node_id on error/skip.
 * Used by the scheduler (and later by a job worker). No after() here.
 */
export async function runGenerationAndPersist(
  sessionId: string,
  nodeId: string,
): Promise<void> {
  const admin = supabaseAdmin;
  const res = await getSessionById(sessionId, admin);

  if (res.error || !res.data) {
    logger.error(
      "runGenerationAndPersist",
      "Session not found or error loading",
      res.error,
    );
    await clearGeneratingNodeId(sessionId, admin);
    return;
  }

  const session = res.data;
  const node = session.nodesById[nodeId];

  if (!node) {
    logger.error("runGenerationAndPersist", "Node not found", nodeId);
    await clearGeneratingNodeId(sessionId, admin);
    return;
  }

  if (node.articleHtml && node.articleHtml.trim().length > 0) {
    await clearGeneratingNodeId(sessionId, admin);
    return;
  }

  try {
    const result = await generateRabbitHoleNode(session, nodeId, {
      onAfterSources: async (s) => {
        const ok = await saveSession(JSON.stringify(s), admin);
        if (ok.error) throw ok.error;
      },
      onAfterArticle: async (s) => {
        const ok = await saveSession(JSON.stringify(s), admin);
        if (ok.error) throw ok.error;
      },
      onAfterBranches: async (s) => {
        const final = { ...s, generatingNodeId: null };
        const ok = await saveSession(JSON.stringify(final), admin);
        if (ok.error) throw ok.error;
        await clearGeneratingNodeId(sessionId, admin);
      },
    });

    if (result.error || !result.data) {
      logger.error(
        "runGenerationAndPersist",
        "Generation failed",
        result.error,
      );
      await clearGeneratingNodeId(sessionId, admin);
      return;
    }
  } catch (err) {
    logger.error("runGenerationAndPersist", "Error during generation", err);
    await clearGeneratingNodeId(sessionId, admin);
  }
}
