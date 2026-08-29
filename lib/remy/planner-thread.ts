"use server";

import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";

import { auth } from "@clerk/nextjs/server";

import { getLatestThreadByFeature, updateThreadRouting } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createChat, loadChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";

const logger = createLogger("lib/remy/planner-thread.ts");

/** Thread `feature` for the dashboard dock's dedicated week-planner conversation. */
const REMY_PLANNER_FEATURE = "remy_planner";

const REMY_PLANNER_TITLE = "Week planner";

export type EnsureRemyPlannerThreadResult =
  | { ok: true; threadId: string; chatData: { thread: Thread; messages: UIMessage[] } }
  | { ok: false; error: string };

/**
 * Resume the user's dedicated Remy planner thread, or create one.
 * Tagged `remy_planner` so later opens reuse the same conversation; full-page
 * chats at `/remy/[id]` stay separate unless they are this thread.
 */
export async function ensureRemyPlannerThread(): Promise<EnsureRemyPlannerThreadResult> {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const ownerRes = await getSupabaseUserId(userId);

  if (ownerRes.error || ownerRes.data === null) {
    return { ok: false, error: "User not found" };
  }

  const latest = await getLatestThreadByFeature(ownerRes.data, REMY_PLANNER_FEATURE);

  if (!latest.error && latest.data) {
    const loaded = await loadChat(latest.data.id);

    if (!loaded.error && loaded.data) {
      return { ok: true, threadId: latest.data.id, chatData: loaded.data };
    }
  }

  const created = await createChat();

  if (created.error || created.data === null) {
    logger.error("ensureRemyPlannerThread", created.error?.message ?? "createChat failed");

    return { ok: false, error: created.error?.message ?? "Failed to create planner thread" };
  }

  const threadId = created.data;
  const path = `/remy/${threadId}`;
  const routing = await updateThreadRouting(threadId, { feature: REMY_PLANNER_FEATURE, path });

  if (!routing.ok) {
    logger.error("ensureRemyPlannerThread", "updateThreadRouting failed");

    return { ok: false, error: "Failed to tag planner thread" };
  }

  const sb = await supabaseServer();
  const { error: titleError } = await sb
    .from("threads")
    .update({ title: REMY_PLANNER_TITLE })
    .eq("id", threadId);

  if (titleError) {
    logger.warn("ensureRemyPlannerThread", `title update failed: ${titleError.message}`);
  }

  const loaded = await loadChat(threadId);

  if (loaded.error || !loaded.data) {
    return { ok: false, error: loaded.error?.message ?? "Failed to load planner thread" };
  }

  return { ok: true, threadId, chatData: loaded.data };
}
