import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getChats } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/chats/route.ts");

/**
 * GET /api/chats
 *
 * Returns the authenticated user's chat threads for the sidebar list.
 * Protected by Clerk (401 when unauthenticated) and by explicit owner_id
 * filtering in the query as a defense-in-depth safeguard alongside RLS.
 */
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error(
      "GET",
      "Supabase user not found for Clerk user",
      sbUserIdResult.error?.message,
    );
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  const ownerId = sbUserIdResult.data;
  const result = await getChats({ ownerId });

  if (result.error) {
    logger.error("GET", "Failed to fetch chats", result.error.message);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: result.data ?? [] });
}
