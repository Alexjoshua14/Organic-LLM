import { NextResponse } from "next/server";

import { enqueueArtifactSync, scheduleArtifactSyncPump } from "./sync-worker";

import { listStaleSpatialArtifactRows } from "@/data/supabase/spatial-artifacts";

const STALE_ROW_LIMIT = 50;

/**
 * Body of `GET /api/cron/sync-spatial-artifacts`. Lives here rather than in the route file so
 * it can take injected dependencies — Next only allows HTTP verb exports from a route.
 *
 * Tests pass `deps` instead of registering module mocks: Bun applies those process-wide, and a
 * stub for the sync worker or the artifact data layer used to leak into the sync worker's own
 * test file and fail it on CI.
 */
export type SpatialArtifactCronDeps = {
  listStaleSpatialArtifactRows: typeof listStaleSpatialArtifactRows;
  enqueueArtifactSync: typeof enqueueArtifactSync;
  scheduleArtifactSyncPump: typeof scheduleArtifactSyncPump;
};

const defaultDeps: SpatialArtifactCronDeps = {
  listStaleSpatialArtifactRows,
  enqueueArtifactSync,
  scheduleArtifactSyncPump,
};

export async function runSpatialArtifactSyncCron(
  request: Request,
  deps: SpatialArtifactCronDeps = defaultDeps
): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleRows = await deps.listStaleSpatialArtifactRows(STALE_ROW_LIMIT);

  for (const row of staleRows) {
    deps.enqueueArtifactSync({
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

  deps.scheduleArtifactSyncPump();

  return NextResponse.json({ ok: true, queued: staleRows.length });
}
