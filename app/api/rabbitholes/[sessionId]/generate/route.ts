import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { scheduleNodeGeneration } from "@/lib/rabbit-holes/scheduleNodeGeneration";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger(
  "app/api/rabbitholes/[sessionId]/generate/route.ts",
);

type Body = { nodeId?: string; session?: string };

/**
 * POST /api/rabbitholes/[sessionId]/generate
 *
 * Schedules async node generation. Returns 202 + jobId; generation runs after response via after().
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const nodeId = body?.nodeId;
  if (!nodeId || typeof nodeId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid nodeId" },
      { status: 400 },
    );
  }

  const session = typeof body?.session === "string" ? body.session : undefined;

  try {
    const { jobId } = await scheduleNodeGeneration({
      sessionId,
      nodeId,
      serializedSession: session,
    });
    return NextResponse.json(
      { jobId, sessionId, nodeId },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("POST", `scheduleNodeGeneration failed: ${message}`);
    return NextResponse.json(
      { error: "Failed to schedule generation" },
      { status: 500 },
    );
  }
}
