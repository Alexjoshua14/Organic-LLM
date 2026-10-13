import "server-only";

import type { UIMessage } from "ai";
import type {
  SubagentThreadRow,
  SubagentThreadSnapshot,
} from "@/lib/llm/subagents/threads/snapshot";
import type { SubagentThreadStatus } from "@/lib/llm/subagents/threads/status";
import type { Message } from "@/lib/schemas/chat";

import { randomUUID } from "crypto";

import { upsertMessagesWithAdmin } from "@/data/supabase/chat-admin";
import { convertMessageToUIMessage } from "@/lib/chat/message-transform";
import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { THREAD_FLAGS } from "@/lib/thread-flags";

/**
 * Arcadia multitask subagent threads (COA-251). Admin client — RLS is bypassed, so every query
 * filters on `owner_id`, and child reads also require the expected `parent_thread_id`.
 *
 * The columns come from `docs/migrations/threads_subagent_threads.sql`. Until it runs, reads
 * return empty and writes report unavailable so callers fall back to the in-stream worker path.
 */

const logger = createLogger("data/supabase/subagent-threads.ts");

const SUBAGENT_COLUMNS = [
  "parent_thread_id",
  "subagent_agent_id",
  "subagent_status",
  "subagent_status_at",
  "subagent_heartbeat_baseline",
  "subagent_heartbeat_digest",
  "subagent_heartbeat_at",
] as const;

export function isMissingSubagentColumnError(message: string | null | undefined): boolean {
  if (!message) return false;

  return (
    SUBAGENT_COLUMNS.some((column) => message.includes(column)) &&
    (message.includes("does not exist") || message.includes("Could not find"))
  );
}

function logQueryError(fn: string, message: string): void {
  if (isMissingSubagentColumnError(message)) {
    logger.warn(fn, "subagent thread columns missing — run threads_subagent_threads.sql");

    return;
  }
  logger.error(fn, message);
}

export type SubagentThreadLink = {
  threadId: string;
  parentThreadId: string;
  agentId: string;
};

/** Cheap worker-presence read; null keeps discovery enabled when the read is unavailable. */
export async function hasSubagentThreadRows(
  parentThreadId: string,
  ownerId: string
): Promise<boolean | null> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("id")
    .eq("parent_thread_id", parentThreadId)
    .eq("owner_id", ownerId)
    .limit(1);

  if (error) {
    logQueryError("hasSubagentThreadRows", error.message);

    return null;
  }

  return (data?.length ?? 0) > 0;
}

/** Delegation requires the owned thread's persisted Multiagent flag; unavailable means off. */
export async function isThreadArcadiaMultitaskEnabled(
  threadId: string,
  ownerId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("arcadia_multitask_view")
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    logQueryError("isThreadArcadiaMultitaskEnabled", error.message);

    return false;
  }

  return data?.arcadia_multitask_view === true;
}

/** When `threadId` is a subagent thread owned by `ownerId`, its parent and slot; else null. */
export async function getSubagentThreadLink(
  threadId: string,
  ownerId: string
): Promise<SubagentThreadLink | null> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("id, parent_thread_id, subagent_agent_id")
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    logQueryError("getSubagentThreadLink", error.message);

    return null;
  }

  if (!data?.parent_thread_id || !data.subagent_agent_id) return null;

  return {
    threadId: data.id,
    parentThreadId: data.parent_thread_id,
    agentId: data.subagent_agent_id,
  };
}

/** Child thread rows for an orchestrator thread, oldest first. Empty when unavailable. */
export async function listSubagentThreadRows(
  parentThreadId: string,
  ownerId: string
): Promise<SubagentThreadRow[]> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("id, subagent_agent_id, subagent_status, subagent_status_at")
    .eq("parent_thread_id", parentThreadId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) {
    logQueryError("listSubagentThreadRows", error.message);

    return [];
  }

  return (data ?? [])
    .filter((row) => typeof row.subagent_agent_id === "string" && row.subagent_agent_id)
    .map((row) => ({
      threadId: row.id as string,
      agentId: row.subagent_agent_id as string,
      status: (row.subagent_status as string | null) ?? null,
      statusAt: (row.subagent_status_at as string | null) ?? null,
    }));
}

/**
 * Find or create the child thread for one roster slot. Returns null when persistence is
 * unavailable (migration missing, parent not owned), so the caller can fall back.
 */
export async function ensureSubagentThread(args: {
  ownerId: string;
  parentThreadId: string;
  agentId: string;
  title: string;
}): Promise<string | null> {
  const { ownerId, parentThreadId, agentId, title } = args;

  const findExisting = async () =>
    supabaseAdmin
      .from("threads")
      .select("id")
      .eq("parent_thread_id", parentThreadId)
      .eq("subagent_agent_id", agentId)
      .eq("owner_id", ownerId)
      .maybeSingle();

  const existing = await findExisting();

  if (existing.error) {
    logQueryError("ensureSubagentThread", existing.error.message);

    return null;
  }

  if (existing.data?.id) return existing.data.id as string;

  const parent = await supabaseAdmin
    .from("threads")
    .select("id")
    .eq("id", parentThreadId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (parent.error || !parent.data) {
    logger.error("ensureSubagentThread", "parent thread not found for owner");

    return null;
  }

  const id = randomUUID();
  const { error } = await supabaseAdmin.from("threads").insert({
    id,
    owner_id: ownerId,
    title,
    flags: THREAD_FLAGS.HAS_TITLE,
    feature: "arcadia",
    path: `/sandbox/arcadia/${id}`,
    parent_thread_id: parentThreadId,
    subagent_agent_id: agentId,
    subagent_status: "idle",
    subagent_status_at: new Date().toISOString(),
  });

  if (!error) return id;

  // Unique (parent, slot): a concurrent turn created it first.
  if (error.code === "23505") {
    const raced = await findExisting();

    return (raced.data?.id as string | undefined) ?? null;
  }

  logQueryError("ensureSubagentThread", error.message);

  return null;
}

export async function setSubagentThreadStatus(args: {
  threadId: string;
  ownerId: string;
  status: SubagentThreadStatus;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("threads")
    .update({ subagent_status: args.status, subagent_status_at: new Date().toISOString() })
    .eq("id", args.threadId)
    .eq("owner_id", args.ownerId);

  if (error) logQueryError("setSubagentThreadStatus", error.message);
}

/** Latest `limit` messages of one owned thread, chronological, decrypted. */
export async function readThreadMessagesWithAdmin(args: {
  threadId: string;
  ownerId: string;
  limit: number;
  messageId?: string;
}): Promise<UIMessage[]> {
  const owned = await supabaseAdmin
    .from("threads")
    .select("id")
    .eq("id", args.threadId)
    .eq("owner_id", args.ownerId)
    .maybeSingle();

  if (owned.error || !owned.data) return [];

  let query = supabaseAdmin
    .from("messages")
    .select("id, thread_id, role, content, schema_kind, schema_version")
    .eq("thread_id", args.threadId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, args.limit));
  if (args.messageId) query = query.eq("id", args.messageId);
  const { data, error } = await query;

  if (error || !data) {
    if (error) logger.error("readThreadMessagesWithAdmin", error.message);

    return [];
  }

  return data
    .map((row) => {
      const message = row as Message;
      const content = decryptFromStorage(
        typeof message.content === "string" ? message.content : JSON.stringify(message.content),
        { userId: args.ownerId, threadId: args.threadId, fieldName: "messages.content" }
      );

      return convertMessageToUIMessage({ ...message, content });
    })
    .filter((m): m is UIMessage => m !== null)
    .reverse();
}

export async function appendThreadMessagesWithAdmin(args: {
  threadId: string;
  ownerId: string;
  messages: UIMessage[];
}): Promise<boolean> {
  const result = await upsertMessagesWithAdmin({
    chatId: args.threadId,
    messages: args.messages,
    ownerId: args.ownerId,
  });

  if (!result.ok) {
    logger.error("appendThreadMessagesWithAdmin", result.error?.message ?? "save failed");
  }

  return result.ok;
}

export type SubagentHeartbeatState = {
  baseline: SubagentThreadSnapshot[] | null;
  digest: string | null;
  at: string | null;
};

function baselineContext(ownerId: string, threadId: string) {
  return {
    userId: ownerId,
    threadId,
    fieldName: "threads.subagent_heartbeat_baseline" as const,
  };
}

/** Heartbeat bookkeeping on the orchestrator row. Null when unavailable. */
export async function getSubagentHeartbeatState(
  threadId: string,
  ownerId: string
): Promise<SubagentHeartbeatState | null> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("subagent_heartbeat_baseline, subagent_heartbeat_digest, subagent_heartbeat_at")
    .eq("id", threadId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error || !data) {
    if (error) logQueryError("getSubagentHeartbeatState", error.message);

    return null;
  }

  let baseline: SubagentThreadSnapshot[] | null = null;
  const stored = data.subagent_heartbeat_baseline as string | null;

  if (stored) {
    try {
      const parsed = JSON.parse(decryptFromStorage(stored, baselineContext(ownerId, threadId)));

      baseline = Array.isArray(parsed) ? (parsed as SubagentThreadSnapshot[]) : null;
    } catch {
      logger.warn("getSubagentHeartbeatState", "unreadable baseline — treating as empty");
    }
  }

  return {
    baseline,
    digest: (data.subagent_heartbeat_digest as string | null) ?? null,
    at: (data.subagent_heartbeat_at as string | null) ?? null,
  };
}

/** Atomically reserve one heartbeat interval without marking a change as evaluated yet. */
export async function claimSubagentHeartbeat(args: {
  threadId: string;
  ownerId: string;
  previousAt: string | null;
  at: string;
}): Promise<boolean> {
  const base = supabaseAdmin.from("threads")
    .update({ subagent_heartbeat_at: args.at })
    .eq("id", args.threadId).eq("owner_id", args.ownerId);
  const guarded = args.previousAt === null
    ? base.is("subagent_heartbeat_at", null)
    : base.eq("subagent_heartbeat_at", args.previousAt);
  const { data, error } = await guarded.select("id");
  if (error) throw new Error("Could not claim heartbeat");
  return (data?.length ?? 0) > 0;
}

/** Commit only a successfully evaluated change; baseline advances only for notable changes. */
export async function completeSubagentHeartbeat(args: {
  threadId: string;
  ownerId: string;
  at: string;
  digest: string;
  baseline?: SubagentThreadSnapshot[];
}): Promise<void> {
  const { data, error } = await supabaseAdmin.from("threads")
    .update({
      subagent_heartbeat_digest: args.digest,
      ...(args.baseline ? { subagent_heartbeat_baseline: encryptForStorage(
        JSON.stringify(args.baseline), baselineContext(args.ownerId, args.threadId)
      ) } : {}),
    })
    .eq("id", args.threadId).eq("owner_id", args.ownerId)
    .eq("subagent_heartbeat_at", args.at).select("id");
  if (error || !data?.length) throw new Error("Could not commit heartbeat state");
}
