import { getSessionById, saveSession } from "@/data/supabase/rabbitholes";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import { generateRabbitHoleNode } from "./actions";

const logger = createLogger("lib/rabbit-holes/runGenerationAndPersist");

/**
 * Clears generating_node_id for a session (e.g. on early exit or error).
 * Used so the client stops polling.
 */
export async function clearGeneratingNodeId(
  sessionId: string,
): Promise<void> {
  const supabase = await supabaseServer();
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
  const res = await getSessionById(sessionId);

  if (res.error || !res.data) {
    logger.error(
      "runGenerationAndPersist",
      "Session not found or error loading",
      res.error,
    );
    await clearGeneratingNodeId(sessionId);
    return;
  }

  const session = res.data;
  const node = session.nodesById[nodeId];

  if (!node) {
    logger.error("runGenerationAndPersist", "Node not found", nodeId);
    await clearGeneratingNodeId(sessionId);
    return;
  }

  if (node.articleHtml && node.articleHtml.trim().length > 0) {
    await clearGeneratingNodeId(sessionId);
    return;
  }

  try {
    const result = await generateRabbitHoleNode(session, nodeId);

    if (result.error || !result.data) {
      logger.error(
        "runGenerationAndPersist",
        "Generation failed",
        result.error,
      );
      await clearGeneratingNodeId(sessionId);
      return;
    }

    const updatedSession: RabbitHoleSession = {
      ...result.data,
      generatingNodeId: null,
    };
    const serialized = JSON.stringify(updatedSession);
    const saveResult = await saveSession(serialized);

    if (saveResult.error) {
      logger.error(
        "runGenerationAndPersist",
        "Failed to save session after generation",
        saveResult.error,
      );
      await clearGeneratingNodeId(sessionId);
    }
  } catch (err) {
    logger.error("runGenerationAndPersist", "Error during generation", err);
    await clearGeneratingNodeId(sessionId);
  }
}
