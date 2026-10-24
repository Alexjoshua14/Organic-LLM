import type { LlmChatActorData } from "@/lib/api/chat-llm-gate";
import type { Result } from "@/types";

import { NextResponse } from "next/server";
import z from "zod";

import { resolveChatStarterByKey } from "@/lib/chat/chat-style-starters";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/api/arcadia-starter-handler.ts");

const BodySchema = z.object({
  threadId: z.uuid(),
  arcadiaStarterKey: z.string().min(1).nullable(),
});

type ArcadiaStarterDeps = {
  /** Auth and rate limits only: saving a key makes no model call. */
  requireActor(): Promise<Result<LlmChatActorData, Response>>;
  setStarterKey(
    threadId: string,
    key: string | null
  ): Promise<{ ok: boolean; error?: { message?: string } | null }>;
};

/**
 * PATCH /api/chat/arcadia-starter
 *
 * Sets or clears the Arcadia starter key on an empty thread. Dependencies are injected, like
 * usage-ledger-handler, so the route is tested without module stubs.
 */
export function createArcadiaStarterHandler(deps: ArcadiaStarterDeps) {
  return async function PATCH(req: Request): Promise<Response> {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const authGate = await deps.requireActor();

    if (authGate.error != null) {
      return authGate.error;
    }

    const { threadId, arcadiaStarterKey } = parsed.data;

    if (arcadiaStarterKey !== null && !resolveChatStarterByKey(arcadiaStarterKey)) {
      return NextResponse.json({ error: "Unknown starter key" }, { status: 400 });
    }

    const result = await deps.setStarterKey(threadId, arcadiaStarterKey);

    if (!result.ok) {
      const message = result.error?.message ?? "Failed to update starter";
      const isLocked = message.includes("empty thread");

      logger.error("PATCH", message, { threadId });

      return NextResponse.json({ error: message }, { status: isLocked ? 409 : 500 });
    }

    return NextResponse.json({ arcadiaStarterKey });
  };
}
