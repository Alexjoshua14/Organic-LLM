import type { GenerationStep, RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { runOneGenerationStep } from "./runOneGenerationStep";

import {
  advanceGenerationStep,
  getSessionById,
  saveSession,
  type RabbitHolesSupabaseClient,
} from "@/data/supabase/rabbitholes";
import { recordThreadActivityWithAdmin } from "@/data/supabase/chat-admin";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const logger = createLogger("lib/rabbit-holes/runGenerationAndPersist");

/**
 * Clears generating_node_id and generation_step for a session (e.g. on early exit or error).
 * Used so the client stops polling. Pass client when running in background (e.g. after())
 * so we don't rely on the user's JWT which may be expired.
 */
export async function clearGeneratingNodeId(
  sessionId: string,
  client?: RabbitHolesSupabaseClient
): Promise<void> {
  const supabase = client ?? (await supabaseServer());
  const { error } = await supabase
    .from("rabbit_hole_sessions")
    .update({
      generating_node_id: null,
      generation_step: null,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    logger.error("clearGeneratingNodeId", `Failed to clear generating_node_id: ${error.message}`);
    throw error;
  }
}

const STEP_ORDER: GenerationStep[] = ["sources", "article", "branch_suggestions"];

function nextStep(step: GenerationStep): GenerationStep | null {
  const i = STEP_ORDER.indexOf(step);

  if (i < 0 || i >= STEP_ORDER.length - 1) return null;

  return STEP_ORDER[i + 1];
}

/** Marks the session as updated now. Best effort: a failure only delays the sidebar signal. */
async function touchSession(sessionId: string, client: RabbitHolesSupabaseClient): Promise<void> {
  const { error } = await client
    .from("rabbit_hole_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (error) {
    logger.warn("runGenerationAndPersist", "Could not refresh session updated_at", error.message);
  }
}

/**
 * A node finished: the session's sidebar thread shows as new until the owner sees it. Sessions
 * whose chat thread was never created have no sidebar row, so there is nothing to mark.
 */
async function recordNodeCompleted(chatThreadId: string | null | undefined): Promise<void> {
  if (!chatThreadId) return;

  const res = await recordThreadActivityWithAdmin({ threadId: chatThreadId });

  if (res.error) {
    logger.warn("runGenerationAndPersist", "Could not record node activity", res.error.message);
  }
}

/**
 * Step-aware orchestrator: loads session, reads generation_step, runs that step (with idempotency),
 * saves, advances step via conditional update (singularity). Loops until step is cleared.
 */
export async function runGenerationAndPersist(sessionId: string, nodeId: string): Promise<void> {
  const admin = supabaseAdmin;
  let res = await getSessionById(sessionId, admin);

  if (res.error || !res.data) {
    logger.error("runGenerationAndPersist", "Session not found or error loading", res.error);
    await clearGeneratingNodeId(sessionId, admin);

    return;
  }

  let session = res.data;
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

  // `saveSession` writes the client's copy of `updated_at`, which can be old when generation is
  // scheduled. Refresh it so the sidebar's working signal (stale after 5 min) sees a live run.
  await touchSession(sessionId, admin);

  try {
    let step: GenerationStep | null = session.generationStep ?? "sources";

    while (step !== null) {
      const nodeAtStep = session.nodesById[nodeId];

      if (!nodeAtStep) break;

      let sessionToSave = session;

      if (step === "sources" && nodeAtStep.sources && nodeAtStep.sources.length > 0) {
        sessionToSave = session;
      } else if (step === "article" && nodeAtStep.articleHtml?.trim()) {
        sessionToSave = session;
      } else if (
        step === "branch_suggestions" &&
        nodeAtStep.branchSuggestions &&
        nodeAtStep.branchSuggestions.length > 0
      ) {
        sessionToSave = session;
      } else {
        const result = await runOneGenerationStep(session, nodeId, step);

        if (result.error || !result.data) {
          logger.error("runGenerationAndPersist", `Step ${step} failed`, result.error);
          await clearGeneratingNodeId(sessionId, admin);

          return;
        }
        sessionToSave = result.data;
      }

      // Do not let the serialized session overwrite generation_step; that column
      // is the orchestrator's single source of truth and is advanced only via
      // advanceGenerationStep. Strip generationStep before serialization so
      // saveSession leaves generation_step untouched.
      const sessionToPersist: RabbitHoleSession = {
        ...sessionToSave,
        generationStep: undefined as any,
      };
      const saveResult = await saveSession(JSON.stringify(sessionToPersist), admin);

      if (saveResult.error) {
        logger.error(
          "runGenerationAndPersist",
          `Failed to save after step ${step}`,
          saveResult.error
        );
        await clearGeneratingNodeId(sessionId, admin);

        return;
      }

      const toStep = nextStep(step);
      const { updated } = await advanceGenerationStep(sessionId, nodeId, step, toStep, admin);

      if (!updated) {
        logger.error(
          "runGenerationAndPersist",
          `Advance from ${step} failed (singularity conflict?)`
        );

        return;
      }

      if (toStep === null) {
        await recordNodeCompleted(sessionToSave.chatThreadId ?? session.chatThreadId);
        break;
      }
      session = sessionToSave;
      step = toStep;
    }
  } catch (err) {
    logger.error("runGenerationAndPersist", "Error during generation", err);
    await clearGeneratingNodeId(sessionId, admin);
  }
}
