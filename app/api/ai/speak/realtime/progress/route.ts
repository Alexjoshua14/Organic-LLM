import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";
import { SpeakSubagentProgressBodySchema } from "@/lib/schemas/speak-subagent-context";
import { formatSubagentProgressBody } from "@/lib/speak/subagent-progress-item";

export const maxDuration = 15;

const logger = createLogger("app/api/ai/speak/realtime/progress/route.ts");

/**
 * Silent subagent progress for a live Speak session.
 *
 * Returns formatted body text; the browser forwards it as a system item **without**
 * `response.create`. Distinct from `/milestone` (spoken) and `/context` (screen ambient).
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

  const parsed = SpeakSubagentProgressBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const session = await getSpeakRealtimeSession(parsed.data.sessionId);

  if (!session || session.userId !== sbUserId || session.status !== "active") {
    return NextResponse.json({ error: "No active session" }, { status: 404 });
  }

  const body = formatSubagentProgressBody(parsed.data);

  logger.log("POST", `Built silent subagent progress for ${parsed.data.agentId}`, {
    sessionId: session.sessionId,
    chars: body.length,
  });

  return NextResponse.json({
    kind: "progress" as const,
    body,
    announce: false,
  });
}
