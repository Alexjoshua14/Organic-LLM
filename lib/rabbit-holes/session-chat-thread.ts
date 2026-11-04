"use server";

import { createChat } from "@/lib/chat/chat-store";
import { loadChat } from "@/lib/chat/chat-store";
import { deleteChat, updateThreadRouting } from "@/data/supabase/chat";
import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/rabbit-holes/session-chat-thread.ts");

export type EnsureRabbitHoleChatThreadResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

/**
 * Ensure a chat thread exists for the rabbit hole session; persist link on session row.
 */
export async function ensureRabbitHoleChatThread(
  sessionId: string
): Promise<EnsureRabbitHoleChatThreadResult> {
  const supabase = await supabaseServer();

  const { data: row, error: fetchError } = await supabase
    .from("rabbit_hole_sessions")
    .select("chat_thread_id, root_question")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (fetchError) {
    logger.error("ensureRabbitHoleChatThread", fetchError.message);

    return { ok: false, error: fetchError.message };
  }

  if (row?.chat_thread_id) {
    return { ok: true, threadId: row.chat_thread_id };
  }

  const createRes = await createChat();

  if (createRes.error || !createRes.data) {
    return { ok: false, error: createRes.error?.message ?? "Failed to create chat thread" };
  }

  const threadId = createRes.data;
  const path = `/rabbitholes?sessionId=${encodeURIComponent(sessionId)}`;
  const routeThread = () =>
    updateThreadRouting(threadId, { feature: "rabbit_hole", path }).catch(() => undefined);

  if (!row) {
    // No session row to link yet; the thread is still usable client-side.
    await routeThread();

    return { ok: true, threadId };
  }

  // Compare-and-set: link only if no concurrent request linked its thread first. The page mounts
  // more than one chat composer, and each bootstraps the thread; without this, simultaneous
  // requests each created a thread and every loser became a duplicate sidebar row whose messages
  // the rabbit hole never showed again.
  const { data: claimed, error: claimError } = await supabase
    .from("rabbit_hole_sessions")
    .update({ chat_thread_id: threadId })
    .eq("session_id", sessionId)
    .is("chat_thread_id", null)
    .select("chat_thread_id")
    .maybeSingle();

  if (claimError) {
    logger.warn(
      "ensureRabbitHoleChatThread",
      `chat_thread_id column update failed: ${claimError.message}`
    );
    // Thread still usable client-side even if column missing in older DBs.
    await routeThread();

    return { ok: true, threadId };
  }

  if (!claimed) {
    // Lost the race: discard ours (it has no messages yet) and use the thread that won.
    const discarded = await deleteChat(threadId);

    if (!discarded.ok) {
      logger.warn("ensureRabbitHoleChatThread", "Could not discard losing thread", threadId);
    }

    const { data: winner, error: winnerError } = await supabase
      .from("rabbit_hole_sessions")
      .select("chat_thread_id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (winnerError || !winner?.chat_thread_id) {
      return { ok: false, error: winnerError?.message ?? "Failed to resolve chat thread" };
    }

    return { ok: true, threadId: winner.chat_thread_id };
  }

  // Route only once linked, so a losing thread never appears in the sidebar.
  await routeThread();

  return { ok: true, threadId };
}

export async function loadRabbitHoleSessionChat(sessionId: string) {
  const ensured = await ensureRabbitHoleChatThread(sessionId);

  if (!ensured.ok) {
    return { ok: false as const, error: ensured.error };
  }

  const loaded = await loadChat(ensured.threadId);

  if (loaded.error || !loaded.data) {
    return { ok: false as const, error: loaded.error?.message ?? "Failed to load chat" };
  }

  return { ok: true as const, threadId: ensured.threadId, chatData: loaded.data };
}
