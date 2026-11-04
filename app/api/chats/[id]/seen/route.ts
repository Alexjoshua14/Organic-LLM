import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { markThreadSeen } from "@/data/supabase/thread-attention";
import { createLogger } from "@/lib/logger";
import { checkChatsActivityLimit } from "@/lib/rate-limit/chats";

const logger = createLogger("app/api/chats/[id]/seen/route.ts");

/**
 * POST /api/chats/[id]/seen
 *
 * Records that the user has the thread on screen, clearing its "new" signal on every device.
 * Called by the sidebar when the open thread holds unseen content in a visible tab.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
    logger.error("POST", "Supabase user not found for Clerk user");

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const result = await markThreadSeen({ threadId: id, ownerId: sbUserIdResult.data });

  if (result.error) {
    logger.error("POST", "Failed to mark thread seen", { err: result.error.message });

    return NextResponse.json({ error: "Failed to mark seen" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
