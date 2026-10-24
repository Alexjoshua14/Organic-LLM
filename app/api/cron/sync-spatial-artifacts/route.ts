import { NextResponse } from "next/server";

import { runSpatialArtifactSyncCron } from "@/lib/spatial-artifacts/sync/cron-sync-handler";

export async function GET(request: Request): Promise<NextResponse> {
  return runSpatialArtifactSyncCron(request);
}
