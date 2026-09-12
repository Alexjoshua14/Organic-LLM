"use server";

import { createChat } from "@/lib/chat/chat-store";
import { loadChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
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

  await updateThreadRouting(threadId, {
    feature: "rabbit_hole",
    path,
  }).catch(() => undefined);

  const { error: updateError } = await supabase
    .from("rabbit_hole_sessions")
    .update({ chat_thread_id: threadId })
    .eq("session_id", sessionId);

  if (updateError) {
    logger.warn("ensureRabbitHoleChatThread", `chat_thread_id column update failed: ${updateError.message}`);
    // Thread still usable client-side even if column missing in older DBs.
  }

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
