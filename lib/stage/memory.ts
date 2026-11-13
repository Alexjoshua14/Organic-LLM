import "server-only";

import type { StageCapture, StageRecallMemory } from "./knowledge";

import { STAGE_MAX_RECALL_ITEMS } from "./schema";
import { stageCaptureMemoryText } from "./knowledge";

import { addMemoryForUser, searchMemoriesForUser } from "@/lib/memory/operations";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/stage/memory.ts");
const RECALL_TIMEOUT_MS = 8_000;

/** Long-term memory lookup for the Recall piece. Never fails a turn: no result is a valid answer. */
export async function recallStageMemories(
  ownerId: string,
  query: string
): Promise<StageRecallMemory[] | null> {
  try {
    const result = await Promise.race([
      searchMemoriesForUser(ownerId, query.slice(0, 300), { limit: STAGE_MAX_RECALL_ITEMS }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RECALL_TIMEOUT_MS)),
    ]);

    if (!result || result.error || !result.data) {
      logger.warn("recallStageMemories", "Recall unavailable", {
        error: result?.error ?? "timeout",
      });

      return null;
    }

    return result.data.results.map((memory) => ({
      text: String(memory.memory ?? ""),
      at: typeof memory.createdAt === "string" ? memory.createdAt : null,
    }));
  } catch (error) {
    logger.warn("recallStageMemories", "Recall failed", { error: String(error) });

    return null;
  }
}

/** Filed thoughts become memories too, so they can be recalled after leaving the stage. */
export async function rememberStageCaptures(ownerId: string, captures: StageCapture[]) {
  if (!captures.length) return;
  try {
    const result = await addMemoryForUser(ownerId, {
      messages: [
        { role: "user", content: stageCaptureMemoryText(captures) },
        { role: "assistant", content: "Filed on Stage." },
      ],
      metadata: { source: "stage", kind: "capture" },
      infer: true,
    });

    if (result.error)
      logger.warn("rememberStageCaptures", "Capture memory write failed", { error: result.error });
  } catch (error) {
    logger.warn("rememberStageCaptures", "Capture memory write failed", { error: String(error) });
  }
}
