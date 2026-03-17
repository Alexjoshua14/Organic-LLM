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
    content: encryptForStorage(
      normalizeStoredString(message.content),
      {
        userId: ownerId,
        threadId: message.thread_id,
        fieldName: "messages.content",
      }
    ),
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
    logger.error("upsertMessagesWithAdmin", `Error upserting messages: ${error?.code ?? "unknown"}`);

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
 * Updates active_stream_id using the admin client. Use when the user JWT may be expired (e.g. in onFinish).
 */
export async function updateChatStreamWithAdmin(params: {
  chatId: string;
  activeStreamId: string | null;
}): Promise<SimpleResult> {
  const { chatId, activeStreamId } = params;

  const sb = supabaseAdmin;
  const { error } = await sb
    .from("threads")
    .update({ active_stream_id: activeStreamId })
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
