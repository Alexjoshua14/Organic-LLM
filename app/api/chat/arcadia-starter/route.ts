import { NextResponse } from "next/server";
import z from "zod";

import { setThreadArcadiaStarterKey } from "@/data/supabase/chat";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { resolveChatStarterByKey } from "@/lib/chat/chat-style-starters";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/chat/arcadia-starter/route.ts");

const BodySchema = z.object({
  threadId: z.uuid(),
  arcadiaStarterKey: z.string().min(1).nullable(),
});

/**
 * PATCH /api/chat/arcadia-starter
 *
 * Sets or clears the Arcadia starter key on an empty thread.
 */
export async function PATCH(req: Request) {
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

  const authGate = await requireLlmChatActor();

  if (authGate.error != null) {
    return authGate.error;
  }

  const { threadId, arcadiaStarterKey } = parsed.data;

  if (arcadiaStarterKey !== null && !resolveChatStarterByKey(arcadiaStarterKey)) {
    return NextResponse.json({ error: "Unknown starter key" }, { status: 400 });
  }

  const result = await setThreadArcadiaStarterKey(threadId, arcadiaStarterKey);

  if (!result.ok) {
    const message = result.error?.message ?? "Failed to update starter";
    const isLocked = message.includes("empty thread");

    logger.error("PATCH", message, { threadId });

    return NextResponse.json({ error: message }, { status: isLocked ? 409 : 500 });
  }

  return NextResponse.json({ arcadiaStarterKey });
}
