import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";
import { SpeakScreenContextBodySchema, screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import { buildAmbientContext } from "@/lib/speak/ambient-context";

export const maxDuration = 15;

const logger = createLogger("app/api/ai/speak/realtime/context/route.ts");

/**
 * Assembles ambient "what the user is looking at" text for a live session.
 *
 * The client cannot build this itself — summaries, compiled Strata documents, and rabbit-hole
 * graphs need server-side reads, decryption, and ownership checks. It also cannot be *sent* from
 * here: the Realtime data channel is held by the browser. So this route returns the text and the
 * provider forwards it as a system item (see `lib/speak/ambient-item.ts`). `label` and `reason`
 * feed the dev "Sees:" chip; they never reach the model.
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

  const parsed = SpeakScreenContextBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const session = await getSpeakRealtimeSession(parsed.data.sessionId);

  if (!session || session.userId !== sbUserId || session.status !== "active") {
    return NextResponse.json({ error: "No active session" }, { status: 404 });
  }

  const context = await buildAmbientContext({ ownerId: sbUserId, surface: parsed.data.surface });
  const surfaceKey = screenSurfaceKey(parsed.data.surface);

  logger.log("POST", `Built ambient context for ${surfaceKey}`, {
    sessionId: session.sessionId,
    chars: context.body.length,
    reason: context.reason,
  });

  return NextResponse.json({ ...context, surfaceKey });
}
