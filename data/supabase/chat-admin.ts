import "server-only";

import { UIMessage } from "ai";

import { Message } from "@/lib/schemas/chat";
import { SimpleResult } from "@/types";
import { convertUIMessageToMessage } from "@/lib/chat/message-transform";
import { encryptForStorage } from "@/lib/crypto/message-encryption";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { createLogger } from "@/lib/logger";

const logger = createLogger("data/supabase/chat-admin.ts");

function normalizeStoredString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function encryptMessageRowContent(message: Message, ownerId: string): Message {
  return {
    ...message,
    content: encryptForStorage(normalizeStoredString(message.content), {
      userId: ownerId,
      threadId: message.thread_id,
      fieldName: "messages.content",
    }),
  };
}

/**
 * Upserts messages using the admin client. Use when the request may have run long (e.g. onFinish
 * after a length-limited response) and the user JWT may be expired. Caller must pass the
 * authenticated ownerId (e.g. sbUserId from the start of the request) for encryption and security.
 */
export async function upsertMessagesWithAdmin(params: {
  chatId: string;
  messages: UIMessage[];
  ownerId: string;
}): Promise<SimpleResult> {
  const { chatId, messages, ownerId } = params;

  const sb = supabaseAdmin;

  const { data: thread, error: threadError } = await sb
    .from("threads")
    .select("id, owner_id")
    .eq("id", chatId)
    .single();

  if (threadError || !thread) {
    return {
      ok: false,
      error: new Error(threadError?.message ?? "Thread not found"),
    };
  }

  if (thread.owner_id !== ownerId) {
    return {
      ok: false,
      error: new Error("Thread owner does not match"),
    };
  }

  const rows = messages
    .map((message) => convertUIMessageToMessage(message, chatId))
    .filter((message): message is Message => message !== null)
    .map((message) => encryptMessageRowContent(message, ownerId));

  if (rows.length === 0) {
    return { ok: true, error: null };
  }

  const { error } = await sb.from("messages").upsert(rows, {
    ignoreDuplicates: true,
  });

  if (error) {
    logger.error(
      "upsertMessagesWithAdmin",
      `Error upserting messages: ${error?.code ?? "unknown"}`
    );

    return {
      ok: false,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  logger.log("upsertMessagesWithAdmin", "Messages upserted successfully");

  return {
    ok: true,
    error: null,
  };
}

/**
 * Replaces one message using the admin client. Caller must pass the authenticated ownerId.
 * Used when a queued turn stamps activated memories after the user JWT may have expired.
 */
export async function updateMessageWithAdmin(params: {
  chatId: string;
  message: UIMessage;
  ownerId: string;
}): Promise<SimpleResult> {
  const { chatId, message, ownerId } = params;

  if (!message.id) {
    return { ok: false, error: new Error("Message id required") };
  }

  const sb = supabaseAdmin;
  const { data: thread, error: threadError } = await sb
    .from("threads")
    .select("id, owner_id")
    .eq("id", chatId)
    .single();

  if (threadError || !thread) {
    return {
      ok: false,
      error: new Error(threadError?.message ?? "Thread not found"),
    };
  }

  if (thread.owner_id !== ownerId) {
    return {
      ok: false,
      error: new Error("Thread owner does not match"),
    };
  }

  const supabaseMessage = convertUIMessageToMessage(message, chatId);

  if (!supabaseMessage) {
    return { ok: false, error: new Error("Invalid message") };
  }

  const row = encryptMessageRowContent(supabaseMessage, ownerId);
  // text_excerpt is NOT NULL. UI messages often omit it; writing null rejects the update.
  const { error } = await sb
    .from("messages")
    .update({
      content: row.content,
      role: row.role,
      ...(typeof row.text_excerpt === "string" ? { text_excerpt: row.text_excerpt } : {}),
    })
    .eq("id", message.id)
    .eq("thread_id", chatId);

  if (error) {
    logger.error("updateMessageWithAdmin", `Error updating message: ${error.code ?? "unknown"}`);

    return {
      ok: false,
      error: new Error(error.message ?? "Unknown error"),
    };
  }

  return { ok: true, error: null };
}

/**
 * Updates active_stream_id using the admin client. Use when the user JWT may be expired (e.g. in onFinish).
 * Clearing the stream also clears `active_stream_started_at`, which ends the sidebar's working signal.
 */
export async function updateChatStreamWithAdmin(params: {
  chatId: string;
  activeStreamId: string | null;
}): Promise<SimpleResult> {
  const { chatId, activeStreamId } = params;

  const sb = supabaseAdmin;
  const { error } = await sb
    .from("threads")
    .update(
      activeStreamId === null
        ? { active_stream_id: null, active_stream_started_at: null }
        : { active_stream_id: activeStreamId }
    )
    .eq("id", chatId);

  if (error) {
    return {
      ok: false,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  return {
    ok: true,
    error: null,
  };
}

/**
 * Stamps `thread_attention.last_activity_at` — content just landed on this thread, so the sidebar
 * shows it as new until the owner sees it. Admin client: callers run after long generations
 * (onFinish, background rabbit-hole steps) where the user JWT may have expired. Never call for
 * Speak; voice is realtime and is never "new".
 */
export async function recordThreadActivityWithAdmin(params: {
  threadId: string;
  /** Looked up from `threads` when omitted. */
  ownerId?: string;
}): Promise<SimpleResult> {
  const sb = supabaseAdmin;
  let ownerId = params.ownerId;

  if (!ownerId) {
    const { data, error } = await sb
      .from("threads")
      .select("owner_id")
      .eq("id", params.threadId)
      .maybeSingle();

    if (error || !data?.owner_id) {
      return { ok: false, error: new Error(error?.message ?? "Thread owner not found") };
    }
    ownerId = String(data.owner_id);
  }

  const { error } = await sb.from("thread_attention").upsert(
    {
      thread_id: params.threadId,
      owner_id: ownerId,
      last_activity_at: new Date().toISOString(),
    },
    { onConflict: "thread_id" }
  );

  if (error) {
    logger.error(
      "recordThreadActivityWithAdmin",
      `Error stamping activity: ${error.code ?? "unknown"}`
    );

    return { ok: false, error: new Error(error.message) };
  }

  return { ok: true, error: null };
}
