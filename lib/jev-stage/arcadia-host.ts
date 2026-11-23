import "server-only";

import { mutateJevStage, readJevStage } from "./store";
import { JEV_STAGE_TURN_DEADLINE_MS } from "./constants";

import { createChat } from "@/lib/chat/chat-store";
import { setThreadArcadiaMultitaskView } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/jev-stage/arcadia-host.ts");

/**
 * Ensure this Jev Stage session has a durable Arcadia multitask parent thread.
 * Child specialist threads hang off it so continue-history can hit prompt cache —
 * same runtime as Arcadia Multiagent, not a Stage Redis duplicate.
 */
export async function ensureJevArcadiaOrchestratorThread(
  ownerId: string
): Promise<string | null> {
  const current = await readJevStage(ownerId);

  if (current.arcadiaThreadId) return current.arcadiaThreadId;

  const created = await createChat("arcadia");

  if (created.error || !created.data) {
    logger.warn("ensureJevArcadiaOrchestratorThread", "createChat failed", {
      error: created.error?.message ?? "null id",
    });

    return null;
  }

  const threadId = created.data;
  const multitask = await setThreadArcadiaMultitaskView(threadId, true);

  if (!multitask.ok) {
    logger.warn("ensureJevArcadiaOrchestratorThread", "multitask enable failed", {
      error: multitask.error?.message ?? "unknown",
      threadId,
    });
    // forceOrchestrator still works even if the flag write failed
  }

  await mutateJevStage(
    ownerId,
    (bundle) =>
      bundle.arcadiaThreadId
        ? bundle
        : {
            ...bundle,
            stage: {
              ...bundle.stage,
              revision: bundle.stage.revision + 1,
              updatedAt: new Date().toISOString(),
            },
            arcadiaThreadId: threadId,
          },
    AbortSignal.timeout(JEV_STAGE_TURN_DEADLINE_MS)
  );

  return threadId;
}
