import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getConversationSummary, getThreadOwnerContext } from "@/data/supabase/chat";
import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptFromStorage } from "@/lib/crypto/message-encryption";

export const maxDuration = 15;

const logger = createLogger("app/api/chat/[id]/arcadia/thread-meta/route.ts");

/**
 * GET /api/chat/[id]/arcadia/thread-meta
 *
 * Returns display title and conversation summary for the Arcadia settings modal.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: chatId } = await params;
  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (threadOwnerContext.data.ownerId !== sbUserIdResult.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = await supabaseServer();
  const { data: threadRow, error: threadError } = await sb
    .from("threads")
    .select("title, feature, conversation_summary")
    .eq("id", chatId)
    .single();

  if (threadError || !threadRow) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (threadRow.feature !== "arcadia") {
    return NextResponse.json({ error: "Not an Arcadia thread" }, { status: 400 });
  }

  const title =
    threadRow.title != null && String(threadRow.title).trim() !== ""
      ? String(threadRow.title).trim()
      : null;

  let summary: string | null = null;

  const summaryResult = await getConversationSummary(chatId);

  if (summaryResult.data?.trim()) {
    summary = summaryResult.data.trim();
  } else if (threadRow.conversation_summary) {
    try {
      const decrypted = decryptFromStorage(String(threadRow.conversation_summary), {
        userId: threadOwnerContext.data.ownerId,
        threadId: chatId,
        fieldName: "threads.conversation_summary",
      });

      if (decrypted.trim()) {
        summary = decrypted.trim();
      }
    } catch (error) {
      logRouteError(logger, "GET", error);
    }
  }

  return NextResponse.json({
    data: {
      title,
      summary,
    },
  });
}
