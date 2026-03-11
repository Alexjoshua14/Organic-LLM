import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { generateChatTitle } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/chat/[id]/generate-title/route.ts");

/**
 * POST /api/chat/[id]/generate-title
 *
 * Generates an AI title for the given chat. Requires auth; RLS restricts to owner's threads.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error(
      "POST",
      "Supabase user not found for Clerk user",
      sbUserIdResult.error?.message,
    );
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  const { id } = await params;

  const result = await generateChatTitle(id);

  if (result.error) {
    const message = result.error.message ?? "Failed to generate title";
    const isNoMessages = message.toLowerCase().includes("no messages");
    logger.error("POST", `Generate title failed: ${message}`);
    return NextResponse.json(
      { error: message },
      { status: isNoMessages ? 400 : 500 },
    );
  }

  return NextResponse.json({
    data: result.data ?? "Chat",
  });
}
