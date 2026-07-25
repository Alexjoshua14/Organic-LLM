import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { assertSpeakBudgetOrClose } from "@/lib/rate-limit/speak-realtime";

export const maxDuration = 15;

const logger = createLogger("app/api/ai/speak/realtime/heartbeat/route.ts");

const HeartbeatSchema = z.object({
  sessionId: z.string().min(1),
  usage: z
    .object({
      inputTokens: z.number().nonnegative().optional(),
      outputTokens: z.number().nonnegative().optional(),
      cachedInputTokens: z.number().nonnegative().optional(),
      audioInputTokens: z.number().nonnegative().optional(),
      audioOutputTokens: z.number().nonnegative().optional(),
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

  const parsed = HeartbeatSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await assertSpeakBudgetOrClose({
    sessionId: parsed.data.sessionId,
    userId: sbUserIdResult.data,
    usage: parsed.data.usage,
  });

  if (!result.ok || result.shouldClose) {
    logger.log("POST", `Heartbeat closing session ${parsed.data.sessionId}: ${result.error}`);

    return NextResponse.json(
      {
        error: result.error ?? "Budget exceeded",
        shouldClose: true,
        session: result.session,
        budget: result.budget,
      },
      { status: 402 }
    );
  }

  return NextResponse.json({
    ok: true,
    shouldClose: false,
    session: result.session,
    budget: result.budget,
  });
}
