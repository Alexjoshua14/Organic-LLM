import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { currentHourBucket, insertPerfEvents, readPerfConsent } from "@/data/supabase/perf-metrics";
import { PERF_MAX_BODY_BYTES, PerfBatchSchema } from "@/lib/perf/events";
import { isSameOriginRequest } from "@/lib/perf/request-guard";
import { checkPerfLimit } from "@/lib/rate-limit/perf";

/**
 * POST /api/perf/ingest — anonymous timing events from a signed-in browser.
 *
 * The session is used to (1) refuse strangers, (2) rate-limit, and (3) look up the account's
 * "share timings" choice. It is never stored with the events: the rows written below carry no
 * account, thread or session key, and the request body, headers and IP are never logged.
 * Events from an account that has not opted in are dropped silently (204), so a stale client
 * cannot keep collecting after the choice is turned off.
 */
export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) return new NextResponse(null, { status: 401 });
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);

  if (declared > PERF_MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  const [{ success }, profile] = await Promise.all([
    checkPerfLimit(userId),
    getSupabaseUserIdCached(userId),
  ]);

  if (!success) return new NextResponse(null, { status: 429 });
  // A quiet drop, not an error: nothing here should ever break the app for the user.
  if (profile.error || !profile.data) return new NextResponse(null, { status: 204 });
  if ((await readPerfConsent(profile.data)) !== "on")
    return new NextResponse(null, { status: 204 });

  const text = await request.text();

  if (text.length > PERF_MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Strict schema: unknown fields, free text, ids and out-of-range numbers are rejected whole.
  const parsed = PerfBatchSchema.safeParse(json);

  if (!parsed.success) return new NextResponse(null, { status: 400 });

  await insertPerfEvents(parsed.data.events, currentHourBucket());

  return new NextResponse(null, { status: 204 });
}
