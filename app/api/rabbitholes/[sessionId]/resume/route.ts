import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSessionById } from "@/data/supabase/rabbitholes";
import { createLogger } from "@/lib/logger";
import { runGenerationAndPersist } from "@/lib/rabbit-holes/runGenerationAndPersist";

export const maxDuration = 60;

const logger = createLogger("app/api/rabbitholes/[sessionId]/resume/route.ts");

/**
 * POST /api/rabbitholes/[sessionId]/resume
 *
 * Resumes generation for a session that has generating_node_id set.
 * Used by Aion or manual retry when generation was interrupted.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  const res = await getSessionById(sessionId);

  if (res.error || !res.data) {
    logger.error("POST", "Session not found or error loading");

    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = res.data;
  const nodeId = session.generatingNodeId;

  if (!nodeId) {
    return NextResponse.json({ message: "No generation in progress", sessionId }, { status: 200 });
  }

  try {
    await runGenerationAndPersist(sessionId, nodeId);

    return NextResponse.json({ message: "Resume completed", sessionId, nodeId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error("POST", "Resume failed");

    return NextResponse.json({ error: "Resume failed" }, { status: 500 });
  }
}
