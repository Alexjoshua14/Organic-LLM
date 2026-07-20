import type { UIMessage } from "ai";

import { auth } from "@clerk/nextjs/server";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import { addMessage } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { addLatestMessagesToMemoryForUser } from "@/lib/memory/operations";
import { getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";

export const maxDuration = 30;

const logger = createLogger("app/api/ai/speak/realtime/persist/route.ts");

const PersistBodySchema = z.object({
  sessionId: z.string().min(1),
  turns: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(8_000),
      })
    )
    .min(1)
    .max(50),
});

function toUIMessage(turn: { role: "user" | "assistant"; text: string }): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: turn.role,
    parts: [{ type: "text", text: turn.text }],
  };
}

/**
 * Persists finalized Realtime voice turns to their thread and extracts memories.
 * Called by the client on the heartbeat and on disconnect with only the turns it
 * hasn't flushed yet, so this stays idempotent. Message save is synchronous (so
 * the summary/title nanobots have rows to read); memory extraction + summary +
 * title run in `after()` to keep the response fast.
 */
export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const sbUserId = sbUserIdResult.data;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = PersistBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const session = await getSpeakRealtimeSession(parsed.data.sessionId);

  if (!session || session.userId !== sbUserId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const threadId = session.threadId;

  if (!threadId) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  const uiMessages = parsed.data.turns.map(toUIMessage);
  let saved = 0;

  for (const message of uiMessages) {
    const res = await addMessage(threadId, message);

    if (res.ok) {
      saved += 1;
    } else {
      logger.warn("POST", `Failed to save voice turn: ${res.error?.message}`);
    }
  }

  after(async () => {
    try {
      await addLatestMessagesToMemoryForUser(sbUserId, uiMessages, threadId);
    } catch (err) {
      logger.warn("POST", `Memory extraction failed: ${String(err)}`);
    }

    try {
      await updateChatSummary(threadId);
      await ensureChatHasTitle(threadId);
    } catch (err) {
      logger.warn("POST", `Summary/title refresh failed: ${String(err)}`);
    }
  });

  logger.log("POST", `Persisted ${saved}/${uiMessages.length} voice turns`, { threadId });

  return NextResponse.json({ ok: true, saved });
}
