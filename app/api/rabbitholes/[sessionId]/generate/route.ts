import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { checkRabbitHoleNodeLimit } from "@/lib/rate-limit/llm";
import { scheduleNodeGeneration } from "@/lib/rabbit-holes/scheduleNodeGeneration";

export const maxDuration = 30;

const logger = createLogger("app/api/rabbitholes/[sessionId]/generate/route.ts");

type Body = { nodeId?: string; session?: string };

/**
 * POST /api/rabbitholes/[sessionId]/generate
 *
 * Schedules async node generation. Returns 202 + jobId; generation runs after response via after().
 */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return NextResponse.json({ error: "User not found in supabase" }, { status: 404 });
  }

  const sbUserId = sbUserIdResult.data;

  const nodeLimitResult = await checkRabbitHoleNodeLimit(sbUserId);

  if (!nodeLimitResult.success) {
    return NextResponse.json(
      { error: nodeLimitResult.error ?? "Rabbit Hole node limit exceeded" },
      { status: 429 }
    );
  }

  const { sessionId } = await params;

  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nodeId = body?.nodeId;

  if (!nodeId || typeof nodeId !== "string") {
    return NextResponse.json({ error: "Missing or invalid nodeId" }, { status: 400 });
  }

  const session = typeof body?.session === "string" ? body.session : undefined;

  try {
    const { jobId } = await scheduleNodeGeneration({
      sessionId,
      nodeId,
      serializedSession: session,
    });

    return NextResponse.json({ jobId, sessionId, nodeId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error("POST", "scheduleNodeGeneration failed");

    return NextResponse.json({ error: "Failed to schedule generation" }, { status: 500 });
  }
}
