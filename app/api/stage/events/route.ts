import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { checkStageLimit } from "@/lib/stage/limit";
import { listStageEvents } from "@/lib/stage/store";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const profile = await getSupabaseUserIdCached(userId);
    if (profile.error || !profile.data) return json({ error: "User not found" }, 404);
    if (!(await checkStageLimit(profile.data))) return json({ error: "Too many requests" }, 429);
    const params = new URL(req.url).searchParams;
    const beforeRaw = params.get("before");
    const limitRaw = params.get("limit");
    const before = beforeRaw === null ? undefined : Number(beforeRaw);
    const limit = limitRaw === null ? 20 : Number(limitRaw);
    if ((before !== undefined && (!Number.isSafeInteger(before) || before < 1)) || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      return json({ error: "Invalid cursor or limit" }, 400);
    }
    return json(await listStageEvents(profile.data, before, limit));
  } catch { return json({ error: "Could not load stage history" }, 500); }
}
