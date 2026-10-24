import { auth } from "@clerk/nextjs/server";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { persistSpeakVoiceTurns } from "@/lib/speak/persist-voice-turns";
import { SPEAK_TURN_BATCH_MAX, SpeakVoiceTurnSchema } from "@/lib/speak/voice-turns";

export const maxDuration = 30;

const logger = createLogger("app/api/ai/speak/realtime/transcript/route.ts");

const TranscriptBodySchema = z.object({
  sessionId: z.string().min(1),
  turns: z.array(SpeakVoiceTurnSchema).min(1).max(SPEAK_TURN_BATCH_MAX),
  /** Set on the last flush before `/end` so the summary refresh is not skipped. */
  final: z.boolean().optional(),
});

export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = TranscriptBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await persistSpeakVoiceTurns({
    userId: sbUserIdResult.data,
    sessionId: parsed.data.sessionId,
    turns: parsed.data.turns,
    final: parsed.data.final,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  after(() => {
    void result.postProcess().catch((err) => {
      logger.warn(
        "POST",
        `post-process failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  });

  logger.log("POST", `Persisted ${result.persisted}/${parsed.data.turns.length} voice turns`, {
    threadId: result.threadId,
    final: parsed.data.final === true,
  });

  return NextResponse.json({
    ok: true,
    threadId: result.threadId,
    persisted: result.persisted,
  });
}
