import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/authorize-cron-request";
import { sweepStaleActiveStreams } from "@/lib/chat/stale-stream-sweep";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const logger = createLogger("app/api/cron/sweep-stale-streams/route.ts");

/**
 * Clears stream markers left by chat streams that died mid-flight. Scheduled every few minutes by
 * Supabase pg_cron (`docs/migrations/stale_stream_sweep_cron.sql`); safe to trigger by hand with
 * the same bearer. See `lib/chat/stale-stream-sweep.ts` for what counts as stale.
 */
async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await sweepStaleActiveStreams();

    if (report.checked > 0) {
      logger.log("sweep", "Stale stream sweep finished", report);
    }

    return NextResponse.json(report);
  } catch (error) {
    logger.error("sweep", error instanceof Error ? error.message : String(error));

    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
