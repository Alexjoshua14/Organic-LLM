import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getThreadOwnerContext } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";

export type OwnedThreadActor = { sbUserId: string; clerkUserId: string };

/**
 * Clerk session + Supabase profile + thread ownership, for thread-scoped routes that do not
 * spend the user's message quota (unlike `requireLlmChatActor`).
 */
export async function requireOwnedThread(
  chatId: string
): Promise<{ ok: true; actor: OwnedThreadActor } | { ok: false; response: NextResponse }> {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return { ok: false, response: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  const owner = await getThreadOwnerContext(chatId);

  if (owner.error || !owner.data) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Thread not found" }, { status: 404 }),
    };
  }

  if (owner.data.ownerId !== sbUserIdResult.data) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, actor: { sbUserId: sbUserIdResult.data, clerkUserId: clerkUser.userId } };
}
