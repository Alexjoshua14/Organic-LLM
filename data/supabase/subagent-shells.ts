import "server-only";

import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { randomUUID } from "crypto";

import { appendThreadMessagesWithAdmin } from "@/data/supabase/subagent-threads";
import { getHardSetSubagent } from "@/lib/llm/subagents/hard-set/registry";
import { buildHelpReflexMessage } from "@/lib/llm/subagents/hard-set/shell";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { THREAD_FLAGS } from "@/lib/thread-flags";

/**
 * Hard-set subagent shell threads: an ordinary Arcadia thread with no parent whose
 * `subagent_agent_id` names a hard-set subagent. Every turn in it runs as that subagent. Uses
 * the columns from `docs/migrations/threads_subagent_threads.sql`; no migration of its own.
 * Admin client — RLS is bypassed, so every query filters on `owner_id`.
 */

const logger = createLogger("data/supabase/subagent-shells.ts");

/** The hard-set subagent this thread is a shell for, or null (also when unavailable). */
export async function getHardSetShellAgentId(
  threadId: string,
  ownerId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("parent_thread_id, subagent_agent_id")
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    logger.error("getHardSetShellAgentId", error.message);

    return null;
  }
  if (!data || data.parent_thread_id) return null;

  return getHardSetSubagent(data.subagent_agent_id as string | null)?.id ?? null;
}

/**
 * New shell thread for one hard-set subagent, seeded with its help menu so it is never blank
 * (blank threads are auto-deleted). Returns the thread id, or null when it could not be saved.
 */
export async function createHardSetShellThread(args: {
  ownerId: string;
  agent: HardSetSubagent;
}): Promise<string | null> {
  const { ownerId, agent } = args;
  const id = randomUUID();
  const { error } = await supabaseAdmin.from("threads").insert({
    id,
    owner_id: ownerId,
    title: `${agent.name} · ${agent.role} shell`,
    flags: THREAD_FLAGS.HAS_TITLE,
    feature: "arcadia",
    path: `/sandbox/arcadia/${id}`,
    subagent_agent_id: agent.id,
  });

  if (error) {
    logger.error("createHardSetShellThread", error.message);

    return null;
  }

  const seeded = await appendThreadMessagesWithAdmin({
    threadId: id,
    ownerId,
    messages: [buildHelpReflexMessage(agent)],
  });

  if (!seeded) {
    await supabaseAdmin.from("threads").delete().eq("id", id).eq("owner_id", ownerId);

    return null;
  }

  return id;
}
