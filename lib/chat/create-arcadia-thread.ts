"use server";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import { PERF_PHASES } from "@/lib/perf/journeys";
import {
  stashServerPhases,
  timeServerPhase,
  type ServerPhaseRecord,
} from "@/lib/perf/server-phase";

const logger = createLogger("lib/chat/create-arcadia-thread.ts");

export type CreateArcadiaThreadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Creates a new thread and marks it as Arcadia, then returns the canonical path.
 * Mirrors {@link app/sandbox/arcadia/page.tsx} without an extra redirect hop.
 */
export async function createArcadiaThreadAction(): Promise<CreateArcadiaThreadResult> {
  const phases: ServerPhaseRecord[] = [];
  const res = await timeServerPhase(phases, PERF_PHASES.serverCreateChat, () =>
    createChat("arcadia")
  );

  if (res.error || res.data === null) {
    logger.error("createArcadiaThreadAction", res.error?.message ?? "createChat failed");

    return { ok: false, error: res.error?.message ?? "Failed to create chat" };
  }

  const id = res.data;
  const path = `/sandbox/arcadia/${id}`;

  stashServerPhases(id, phases);

  return { ok: true, path };
}
