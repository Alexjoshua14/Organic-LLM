import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { hasSubagentThreadRows } from "@/data/supabase/subagent-threads";
import {
  getThreadArcadiaMultitaskView,
  getThreadOwnerContext,
  setThreadArcadiaMultitaskView,
} from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

export const maxDuration = 15;

const logger = createLogger("app/api/chat/[id]/arcadia/multitask-view/route.ts");

const PatchBodySchema = z.object({
  enabled: z.boolean(),
});

/**
 * GET /api/chat/[id]/arcadia/multitask-view
 *
 * Per-thread multitask dashboard flag + active_stream_id for the toggle gate.
 * Includes worker presence so ordinary chat can avoid board/message polling.
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
  const owner = await getThreadOwnerContext(chatId);

  if (owner.error || !owner.data) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (owner.data.ownerId !== sbUserIdResult.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [result, hasSubagentThreads] = await Promise.all([
    getThreadArcadiaMultitaskView(chatId),
    hasSubagentThreadRows(chatId, sbUserIdResult.data),
  ]);

  if (result.error || !result.data) {
    logger.error("GET", result.error?.message ?? "read failed", { chatId });

    return NextResponse.json({ error: "Failed to read multitask view" }, { status: 500 });
  }

  return NextResponse.json(
    {
      threadId: chatId,
      enabled: result.data.enabled,
      activeStreamId: result.data.activeStreamId,
      hasSubagentThreads,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * PATCH /api/chat/[id]/arcadia/multitask-view
 *
 * Sets the flag. Refuses (409) while the thread has an active LLM stream.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: chatId } = await params;
  const owner = await getThreadOwnerContext(chatId);

  if (owner.error || !owner.data) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (owner.data.ownerId !== sbUserIdResult.data) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await setThreadArcadiaMultitaskView(chatId, parsed.data.enabled);

  if (!result.ok) {
    const streaming = result.error?.message?.includes("active stream");

    logger.warn("PATCH", result.error?.message ?? "update failed", { chatId });

    return NextResponse.json(
      {
        error: result.error?.message ?? "Failed to update",
        activeStreamId: result.activeStreamId ?? null,
      },
      { status: streaming ? 409 : 500 }
    );
  }

  return NextResponse.json({
    threadId: chatId,
    enabled: parsed.data.enabled,
    activeStreamId: null,
  });
}
