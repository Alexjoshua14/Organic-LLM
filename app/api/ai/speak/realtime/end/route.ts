import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { endSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";

export const maxDuration = 15;

const logger = createLogger("app/api/ai/speak/realtime/end/route.ts");

const EndSchema = z.object({
  sessionId: z.string().min(1),
  /** Set when the SDP exchange failed. It runs in the browser, so this is the server's only report. */
  connectFailure: z
    .object({
      status: z.number().int(),
      detail: z.string().max(500),
    })
    .optional(),
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

  const parsed = EndSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (parsed.data.connectFailure) {
    logger.error(
      "POST",
      `Realtime connect failed for ${parsed.data.sessionId}`,
      parsed.data.connectFailure
    );
  }

  const session = await endSpeakRealtimeSession({
    sessionId: parsed.data.sessionId,
    userId: sbUserIdResult.data,
  });

  return NextResponse.json({ ok: true, session });
}
