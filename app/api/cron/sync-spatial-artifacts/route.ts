import { NextResponse } from "next/server";

import { listStaleSpatialArtifactRows } from "@/data/supabase/spatial-artifacts";
import {
  enqueueArtifactSync,
  scheduleArtifactSyncPump,
} from "@/lib/spatial-artifacts/sync/sync-worker";

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleRows = await listStaleSpatialArtifactRows(50);

  for (const row of staleRows) {
    enqueueArtifactSync({
      artifactId: row.id,
      ownerId: row.owner_id,
      threadId: row.thread_id,
      messageId: row.message_id,
      toolCallId: row.tool_call_id,
      priority: "low",
      force: true,
      coalescenceMode: true,
    });
  }

  scheduleArtifactSyncPump();

  return NextResponse.json({ ok: true, queued: staleRows.length });
}
