import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getChats } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { checkChatsListLimit } from "@/lib/rate-limit/chats";

const logger = createLogger("app/api/chats/route.ts");

/**
 * GET /api/chats
 *
 * Returns the authenticated user's chat threads for the sidebar list.
 * Rate-limited (240/hour per user). Protected by Clerk (401 when unauthenticated)
 * and by explicit owner_id filtering as a defense-in-depth safeguard alongside RLS.
 * See docs/thread-session-architecture.md for API and cache contract.
 */
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await checkChatsListLimit(userId);

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

  const ownerId = sbUserIdResult.data;
  const result = await getChats({ ownerId });

  if (result.error) {
    logger.error("GET", "Failed to fetch chats");

    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }

  return NextResponse.json({ data: result.data ?? [] });
}
