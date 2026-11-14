import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { readPerfConsent, writePerfConsent } from "@/data/supabase/perf-metrics";
import { isSameOriginRequest } from "@/lib/perf/request-guard";
import { checkPerfLimit } from "@/lib/rate-limit/perf";

const BodySchema = z.object({ enabled: z.boolean() }).strict();

/**
 * GET /api/perf/consent — whether this account currently shares anonymous timings:
 * `{ state: "on" | "off" | "unset" | "unavailable" }`. Only the signed-in user's own state.
 * PUT /api/perf/consent `{ enabled }` — turns sharing on or off for this account, going forward.
 * Past numbers are not touched: they carry no account key, so they cannot be traced back.
 */
export async function GET() {
  const { userId } = await auth();

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getSupabaseUserIdCached(userId);

  if (profile.error || !profile.data) return NextResponse.json({ state: "unavailable" });

  return NextResponse.json({ state: await readPerfConsent(profile.data) });
}

export async function PUT(request: Request) {
  const { userId } = await auth();

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { success } = await checkPerfLimit(userId);

  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const profile = await getSupabaseUserIdCached(userId);

  if (profile.error || !profile.data) return NextResponse.json({ state: "unavailable" });

  return NextResponse.json({ state: await writePerfConsent(profile.data, parsed.data.enabled) });
}
