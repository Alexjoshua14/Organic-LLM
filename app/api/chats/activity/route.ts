import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getThreadAttention } from "@/data/supabase/thread-attention";
import { createLogger } from "@/lib/logger";
import { checkChatsActivityLimit } from "@/lib/rate-limit/chats";
import { SESSION_WORKING_STALE_MS } from "@/lib/sidebar/session-signal-timing";

const logger = createLogger("app/api/chats/activity/route.ts");

/**
 * GET /api/chats/activity
 *
 * Sidebar attention for the signed-in user: threads that are working (a reply streaming, a
 * rabbit-hole node generating) or hold unseen content. Threads with neither are omitted. Polled
 * by `useSidebarActivity` only while something is working. Contract:
 * docs/thread-session-architecture.md.
 */
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await checkChatsActivityLimit(userId);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: rateLimitResult.error ?? "Too many requests" },
      { status: 429 }
    );
  }

  const sbUserIdResult = await getSupabaseUserId(userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error("GET", "Supabase user not found for Clerk user");

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await getThreadAttention({
    ownerId: sbUserIdResult.data,
    staleAfterMs: SESSION_WORKING_STALE_MS,
  });

  if (result.error) {
    logger.error("GET", "Failed to fetch thread activity", { err: result.error.message });

    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }

  return NextResponse.json({ data: result.data ?? [] });
}
