import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { executeSpeakRealtimeTool } from "@/lib/speak/execute-speak-tool";

export const maxDuration = 60;

const logger = createLogger("app/api/ai/speak/realtime/tool/route.ts");

const ToolBodySchema = z.object({
  sessionId: z.string().min(1),
  callId: z.string().min(1).optional(),
  name: z.string().min(1),
  arguments: z.string().default("{}"),
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

  const parsed = ToolBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await executeSpeakRealtimeTool({
    userId: sbUserIdResult.data,
    sessionId: parsed.data.sessionId,
    name: parsed.data.name,
    argumentsJson: parsed.data.arguments,
  });

  if (!result.ok && result.error?.includes("Budget")) {
    return NextResponse.json(
      {
        error: result.error,
        shouldClose: true,
        modelResult: result.modelResult,
        clientEffects: result.clientEffects,
      },
      { status: 402 }
    );
  }

  logger.log("POST", `Tool ${parsed.data.name}`, {
    ok: result.ok,
    effects: result.clientEffects.length,
  });

  return NextResponse.json({
    ok: result.ok,
    error: result.error,
    callId: parsed.data.callId ?? null,
    modelResult: result.modelResult,
    clientEffects: result.clientEffects,
  });
}
