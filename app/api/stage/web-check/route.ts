import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { checkStageWebLimit } from "@/lib/stage/limit";
import { checkStageWeb } from "@/lib/stage/web-check";

const headers = { "Cache-Control": "private, max-age=300" };

/** Whether a page can be framed in a Stage piece, so a refusing site gets a card, not a blank pane. */
export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getSupabaseUserIdCached(userId);

  if (profile.error || !profile.data)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!(await checkStageWebLimit(profile.data)))
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const url = new URL(req.url).searchParams.get("url") ?? "";

  return NextResponse.json(await checkStageWeb(url, new URL(req.url).hostname), { headers });
}
