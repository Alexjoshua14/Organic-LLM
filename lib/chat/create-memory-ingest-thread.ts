"use server";

import { createChat } from "@/lib/chat/chat-store";
import { MEMORY_INGEST_FEATURE } from "@/lib/chat/memory-ingest";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/create-memory-ingest-thread.ts");

export type CreateMemoryIngestThreadResult =
  | { ok: true; id: string; path: string }
  | { ok: false; error: string };

/**
 * Creates a new thread, tags it as a Memory ingest (Delphi) session so it stays
 * out of the main chat sidebar, and returns its canonical chamber path.
 * Mirrors {@link createArcadiaThreadAction}.
 */
export async function createMemoryIngestThread(): Promise<CreateMemoryIngestThreadResult> {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("createMemoryIngestThread", res.error?.message ?? "createChat failed");

    return { ok: false, error: res.error?.message ?? "Failed to create chat" };
  }

  const id = res.data;
  const path = `/sandbox/prototypes/memory-ingest/${id}`;
  const routingRes = await updateThreadRouting(id, { feature: MEMORY_INGEST_FEATURE, path });

  if (!routingRes.ok) {
    logger.error("createMemoryIngestThread", "updateThreadRouting failed");

    return { ok: false, error: "Failed to set Memory ingest routing" };
  }

  return { ok: true, id, path };
}
