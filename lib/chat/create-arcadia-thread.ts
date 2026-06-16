"use server";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/create-arcadia-thread.ts");

export type CreateArcadiaThreadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Creates a new thread and marks it as Arcadia, then returns the canonical path.
 * Mirrors {@link app/sandbox/arcadia/page.tsx} without an extra redirect hop.
 */
export async function createArcadiaThreadAction(): Promise<CreateArcadiaThreadResult> {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("createArcadiaThreadAction", res.error?.message ?? "createChat failed");

    return { ok: false, error: res.error?.message ?? "Failed to create chat" };
  }

  const id = res.data;
  const path = `/sandbox/arcadia/${id}`;
  const routingRes = await updateThreadRouting(id, { feature: "arcadia", path });

  if (!routingRes.ok) {
    logger.error("createArcadiaThreadAction", "updateThreadRouting failed");

    return { ok: false, error: "Failed to set Arcadia routing" };
  }

  return { ok: true, path };
}
