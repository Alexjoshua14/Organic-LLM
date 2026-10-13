import "server-only";

import type {
  MessageSendQueuePayload,
  MessageSendQueueRow,
  MessageSendQueueStatus,
} from "@/lib/schemas/message-send-queue";

import { OPEN_QUEUE_STATUSES } from "@/lib/schemas/message-send-queue";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const logger = createLogger("data/supabase/message-send-queue.ts");

function isMissingTableError(message: string): boolean {
  return message.includes("message_send_queue") && message.includes("does not exist");
}

export async function insertQueuedMessage(args: {
  id?: string;
  ownerId: string;
  threadId: string;
  body: string;
  targetAgentId?: string | null;
  payload?: MessageSendQueueRow["payload"];
}): Promise<MessageSendQueueRow | null> {
  const { ownerId, threadId, body, targetAgentId, payload } = args;

  // Next position within the thread (FIFO).
  const { data: last, error: lastError } = await supabaseAdmin
    .from("message_send_queue")
    .select("position")
    .eq("thread_id", threadId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError && !isMissingTableError(lastError.message)) {
    logger.warn("insertQueuedMessage:position", lastError.message);

    return null;
  }

  if (lastError && isMissingTableError(lastError.message)) {
    logger.warn("insertQueuedMessage", "message_send_queue table missing — run migration");

    return null;
  }

  const position = (typeof last?.position === "number" ? last.position : 0) + 1;

  const { data, error } = await supabaseAdmin
    .from("message_send_queue")
    .insert({
      ...(args.id ? { id: args.id } : {}),
      owner_id: ownerId,
      thread_id: threadId,
      target_agent_id: targetAgentId ?? null,
      body,
      payload: payload ?? {},
      position,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && args.id) {
      const existing = await supabaseAdmin.from("message_send_queue").select("*")
        .eq("id", args.id).eq("owner_id", ownerId).eq("thread_id", threadId).maybeSingle();
      return existing.data as MessageSendQueueRow | null;
    }
    if (isMissingTableError(error.message)) {
      logger.warn("insertQueuedMessage", "message_send_queue table missing — run migration");

      return null;
    }
    logger.warn("insertQueuedMessage", error.message);

    return null;
  }

  return data as MessageSendQueueRow;
}

export async function listOpenQueuedMessages(args: {
  ownerId: string;
  threadId?: string;
  limit?: number;
}): Promise<MessageSendQueueRow[]> {
  let query = supabaseAdmin
    .from("message_send_queue")
    .select("*")
    .eq("owner_id", args.ownerId)
    .in("status", OPEN_QUEUE_STATUSES)
    .order("position", { ascending: true })
    .limit(args.limit ?? 50);

  if (args.threadId) {
    query = query.eq("thread_id", args.threadId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error.message)) {
      logger.warn("listOpenQueuedMessages", "message_send_queue table missing — run migration");

      return [];
    }
    logger.warn("listOpenQueuedMessages", error.message);

    return [];
  }

  return (data ?? []) as MessageSendQueueRow[];
}

/**
 * Oldest open item for a thread that is eligible to attempt dispatch
 * (pending or previously held). Skips items already dispatching.
 */
export async function claimNextQueuedMessage(args: {
  ownerId: string;
  threadId: string;
}): Promise<MessageSendQueueRow | null> {
  const { data: candidate, error: selectError } = await supabaseAdmin
    .from("message_send_queue")
    .select("*")
    .eq("owner_id", args.ownerId)
    .eq("thread_id", args.threadId)
    .in("status", ["pending", "blocked_streaming", "blocked_budget"])
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    if (isMissingTableError(selectError.message)) return null;
    logger.warn("claimNextQueuedMessage:select", selectError.message);

    return null;
  }

  if (!candidate) return null;

  const { data: claimed, error: updateError } = await supabaseAdmin
    .from("message_send_queue")
    .update({
      status: "dispatching",
      hold_reason: null,
      dispatched_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", candidate.id)
    .in("status", ["pending", "blocked_streaming", "blocked_budget"])
    .select("*")
    .maybeSingle();

  if (updateError) {
    logger.warn("claimNextQueuedMessage:update", updateError.message);

    return null;
  }

  return (claimed as MessageSendQueueRow | null) ?? null;
}

export async function updateQueuedMessageStatus(args: {
  id: string;
  status: MessageSendQueueStatus;
  holdReason?: string | null;
  error?: string | null;
  sentAt?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    status: args.status,
    hold_reason: args.holdReason ?? null,
  };

  if (args.error !== undefined) patch.error = args.error;
  if (args.sentAt !== undefined) patch.sent_at = args.sentAt;
  if (args.status === "sent") {
    patch.sent_at = args.sentAt ?? new Date().toISOString();
    patch.hold_reason = null;
  }

  const { error } = await supabaseAdmin.from("message_send_queue").update(patch).eq("id", args.id);

  if (error) {
    logger.warn("updateQueuedMessageStatus", error.message);
  }
}

export async function releaseClaimedMessage(args: {
  id: string;
  status: "blocked_streaming" | "blocked_budget" | "pending" | "failed";
  holdReason?: string | null;
  error?: string | null;
}): Promise<void> {
  await updateQueuedMessageStatus({
    id: args.id,
    status: args.status,
    holdReason: args.holdReason ?? null,
    error: args.error ?? null,
  });
}

export async function getThreadActiveStreamId(threadId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("threads")
    .select("active_stream_id")
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    logger.warn("getThreadActiveStreamId", error.message);

    return null;
  }

  return (data?.active_stream_id as string | null | undefined) ?? null;
}

/**
 * Count threads with a live stream for this owner (non-null active_stream_id).
 * Reused by the plan simultaneous-stream gate — not a separate concurrency subsystem.
 */
export async function countOwnerActiveStreams(ownerId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("threads")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .not("active_stream_id", "is", null);

  if (error) {
    logger.warn("countOwnerActiveStreams", error.message);

    return 0;
  }

  return count ?? 0;
}

/** Cross-process reservation shared with live chat, released only by its current holder. */
export async function reserveThreadStream(args: {
  threadId: string; ownerId: string; streamId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from("threads")
    .update({ active_stream_id: args.streamId })
    .eq("id", args.threadId).eq("owner_id", args.ownerId).is("active_stream_id", null)
    .select("id");
  if (error) throw new Error("Could not reserve thread");
  return Boolean(data?.length);
}

export async function releaseThreadStream(args: {
  threadId: string; ownerId: string; streamId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("threads").update({ active_stream_id: null })
    .eq("id", args.threadId).eq("owner_id", args.ownerId).eq("active_stream_id", args.streamId);
  if (error) throw new Error("Could not release thread");
}
