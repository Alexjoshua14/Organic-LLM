import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getThreadOwnerContext } from "@/data/supabase/chat";
import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import { regenerateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { checkArcadiaSettingsSummaryLimit } from "@/lib/rate-limit/arcadia-chat-settings";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

const logger = createLogger("app/api/chat/[id]/arcadia/regenerate-summary/route.ts");

/**
 * POST /api/chat/[id]/arcadia/regenerate-summary
 *
 * Regenerates the Arcadia conversation summary from the Arcadia settings modal.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: chatId } = await params;
  const sbUserId = sbUserIdResult.data;
  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (threadOwnerContext.data.ownerId !== sbUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = await supabaseServer();
  const { data: threadRow, error: threadError } = await sb
    .from("threads")
    .select("feature")
    .eq("id", chatId)
    .single();

  if (threadError || !threadRow) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (threadRow.feature !== "arcadia") {
    return NextResponse.json({ error: "Not an Arcadia thread" }, { status: 400 });
  }

  const limitResult = await checkArcadiaSettingsSummaryLimit(sbUserId, chatId);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  const result = await regenerateChatSummary(chatId);

  if (result.error) {
    const message = result.error;
    const isNoMessages = message.toLowerCase().includes("no messages");

    if (isNoMessages) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logRouteError(logger, "POST", result.error);

    return clientErrorJson(500);
  }

  return NextResponse.json({
    data: result.data ?? "",
  });
}
