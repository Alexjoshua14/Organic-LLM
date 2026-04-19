"use server";

import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "./profiles";

import { Message, Thread, ThreadSchema } from "@/lib/schemas/chat";
import { Result, SimpleResult } from "@/types";
import { clearFlag, setFlag, THREAD_FLAGS } from "@/lib/thread-flags";
import {
  type EncryptionContext,
  decryptFromStorage,
  encryptForStorage,
} from "@/lib/crypto/message-encryption";
import { convertMessageToUIMessage, convertUIMessageToMessage } from "@/lib/chat/message-transform";
import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("data/supabase/chat.ts");

const DEFAULT_MESSAGE_LIMIT = 10;

type ThreadOwnerContext = {
  threadId: string;
  ownerId: string;
};

function normalizeStoredString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function buildMessageContentContext(ownerId: string, threadId: string): EncryptionContext {
  return {
    userId: ownerId,
    threadId,
    fieldName: "messages.content",
  };
}

function buildThreadSummaryContext(ownerId: string, threadId: string): EncryptionContext {
  return {
    userId: ownerId,
    threadId,
    fieldName: "thread_summaries.summary_text",
  };
}

function buildConversationSummaryContext(ownerId: string, threadId: string): EncryptionContext {
  return {
    userId: ownerId,
    threadId,
    fieldName: "threads.conversation_summary",
  };
}

function encryptMessageRowContent(message: Message, ownerId: string): Message {
  return {
    ...message,
    content: encryptForStorage(
      normalizeStoredString(message.content),
      buildMessageContentContext(ownerId, message.thread_id)
    ),
  };
}

function decryptMessageRowContent(message: Message, ownerId: string): Message {
  return {
    ...message,
    content: decryptFromStorage(
      normalizeStoredString(message.content),
      buildMessageContentContext(ownerId, message.thread_id)
    ),
  };
}

function encryptThreadSummaryText(summaryText: string, ownerId: string, chatId: string): string {
  return encryptForStorage(summaryText, buildThreadSummaryContext(ownerId, chatId));
}

function decryptThreadSummaryText(summaryText: string, ownerId: string, chatId: string): string {
  return decryptFromStorage(summaryText, buildThreadSummaryContext(ownerId, chatId));
}

function encryptConversationSummaryValue(
  conversationSummary: string,
  ownerId: string,
  chatId: string
): string {
  return encryptForStorage(conversationSummary, buildConversationSummaryContext(ownerId, chatId));
}

async function getThreadOwnerContextWithClient(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  chatId: string
): Promise<Result<ThreadOwnerContext>> {
  const { data, error } = await sb.from("threads").select("id, owner_id").eq("id", chatId).single();

  if (error || !data) {
    return {
      data: null,
      error: new Error(error?.message ?? "Thread not found"),
    };
  }

  return {
    data: {
      threadId: data.id,
      ownerId: data.owner_id,
    },
    error: null,
  };
}

export async function getThreadOwnerContext(chatId: string): Promise<Result<ThreadOwnerContext>> {
  const sb = await supabaseServer();

  return getThreadOwnerContextWithClient(sb, chatId);
}

/**
 * Fetches thread list for the current (or specified) user.
 * Needs to run with local user credentials; cannot use service role.
 *
 * When `ownerId` is provided, the query explicitly filters by `owner_id` as a
 * defense-in-depth safeguard alongside RLS. When omitted, RLS alone enforces
 * row access (existing callers).
 *
 * @param options.ownerId - Optional Supabase profile ID; when set, only threads
 *   with this owner_id are returned.
 */
export async function getChats(options?: { ownerId?: string }): Promise<Result<Thread[]>> {
  const sb = await supabaseServer();
  const baseQuery = sb
    .from("threads")
    .select("id, title, owner_id, created_at, updated_at, pinned, feature, path")
    .order("updated_at", { ascending: false });

  const { data, error } = options?.ownerId
    ? await baseQuery.eq("owner_id", options.ownerId)
    : await baseQuery;

  return {
    data: data,
    error: error,
  };
}

// Message management functions
/**
 * Loads all messages for a thread as UIMessage array (compatible with AI SDK)
 * @param threadId - The thread ID
 * @returns Array of UIMessage objects
 */
export async function loadChat(
  chatId: string
): Promise<Result<{ thread: Thread; messages: UIMessage[] }>> {
  const sb = await supabaseServer();

  const { data: thread, error: threadErr } = await sb
    .from("threads")
    .select("*")
    .eq("id", chatId)
    .single();

  if (threadErr || !thread) {
    return {
      data: null,
      error: new Error(threadErr?.message ?? "Unknown error"),
    };
  }
  const { data: uiMessages, error: messagesErr } = await getMessages(chatId);

  if (messagesErr || !uiMessages) {
    return {
      data: null,
      error: new Error(messagesErr?.message ?? "Unknown error"),
    };
  }

  const chat = {
    thread: ThreadSchema.parse(thread),
    messages: uiMessages,
  };

  return {
    data: chat,
    error: null,
  };
}

/**
 * Saves unsaved messages for a thread (used by AI SDK onFinish callback)
 * @param params - Thread ID and messages array
 */
export async function saveChat(params: {
  chatId: string;
  messages: UIMessage[];
  activeStreamId?: string;
}): Promise<SimpleResult> {
  const { chatId, messages } = params;

  const sb = await supabaseServer();

  let threadOwnerContextResult = await getThreadOwnerContextWithClient(sb, chatId);

  if (threadOwnerContextResult.error || !threadOwnerContextResult.data) {
    const { error } = await createChat(chatId);

    if (error) {
      return {
        ok: false,
        error: new Error(error?.message ?? "Error occured creating chat thread.."),
      };
    }

    threadOwnerContextResult = await getThreadOwnerContextWithClient(sb, chatId);
  }

  if (threadOwnerContextResult.error || !threadOwnerContextResult.data) {
    return {
      ok: false,
      error: threadOwnerContextResult.error ?? new Error("Thread owner not found"),
    };
  }

  const { count, error: countErr } = await sb
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("thread_id", chatId);

  if (countErr) {
    return {
      ok: false,
      error: new Error(countErr?.message ?? "Unknown error"),
    };
  }

  if (params.activeStreamId !== undefined) {
    const { error: streamError } = await sb
      .from("threads")
      .update({ active_stream_id: params.activeStreamId })
      .eq("id", chatId);

    if (streamError) {
      return {
        ok: false,
        error: new Error(streamError?.message ?? "Unknown error"),
      };
    }
  }

  const alreadySaved = Math.max(0, count ?? 0);
  const tail = messages.slice(alreadySaved);

  if (tail.length === 0) {
    return {
      ok: true,
      error: null,
    };
  }

  const ownerId = threadOwnerContextResult.data.ownerId;

  const rows = tail
    .map((message) => convertUIMessageToMessage(message, chatId))
    .filter((message): message is Message => message !== null)
    .map((message) => encryptMessageRowContent(message, ownerId));

  if (rows.length !== tail.length) {
    logger.error("saveChat", "A message was not converted to supabase message");
  }

  const { error } = await sb.from("messages").insert(rows);

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
 *
 * @param chatId - The chat ID
 * @returns Chat ID
 */
export async function createChat(chatId?: string): Promise<Result<string>> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return {
      data: null,
      error: new Error("User not authenticated"),
    };
  }

  const sb = await supabaseServer();

  const supabaseUserId = await getSupabaseUserId(clerkUserId);

  if (supabaseUserId.error || supabaseUserId.data === null) {
    return {
      data: null,
      error: new Error("User not found in supabase.."),
    };
  }

  const { data, error } = await sb
    .from("threads")
    .insert({
      id: chatId ?? undefined,
      owner_id: supabaseUserId.data,
    })
    .select("id")
    .single();

  if (error) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  return {
    data: data.id,
    error: null,
  };
}

/**
 * Adds a single message to a thread
 * @param threadId - The thread ID
 * @param message - The UIMessage to add
 * @returns The created message record
 */
export async function addMessage(threadId: string, message: UIMessage): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContextWithClient(sb, threadId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      ok: false,
      error: threadOwnerContext.error ?? new Error("Thread owner not found"),
    };
  }

  const supabaseMessage = convertUIMessageToMessage(message, threadId);

  if (!supabaseMessage) {
    return {
      ok: false,
      error: new Error("Invalid message"),
    };
  }

  const { error } = await sb
    .from("messages")
    .insert(encryptMessageRowContent(supabaseMessage, threadOwnerContext.data.ownerId));

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
 * Updates a single message by id (e.g. after editing wine list content).
 * Message must belong to the given thread.
 */
export async function updateMessage(
  threadId: string,
  messageId: string,
  uiMessage: UIMessage
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContextWithClient(sb, threadId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      ok: false,
      error: threadOwnerContext.error ?? new Error("Thread owner not found"),
    };
  }

  const supabaseMessage = convertUIMessageToMessage(uiMessage, threadId);

  if (!supabaseMessage) {
    return {
      ok: false,
      error: new Error("Invalid message"),
    };
  }

  const row = encryptMessageRowContent(supabaseMessage, threadOwnerContext.data.ownerId);

  const { error } = await sb
    .from("messages")
    .update({
      content: row.content,
      role: row.role,
      text_excerpt: row.text_excerpt ?? null,
    })
    .eq("id", messageId)
    .eq("thread_id", threadId);

  if (error) {
    logger.error("updateMessage", `Error updating message: ${error?.code ?? "unknown"}`);

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

export async function upsertMessages(params: {
  chatId: string;
  messages: UIMessage[];
}): Promise<SimpleResult> {
  const { chatId, messages } = params;

  const sb = await supabaseServer();

  let threadOwnerContextResult = await getThreadOwnerContextWithClient(sb, chatId);

  if (threadOwnerContextResult.error || !threadOwnerContextResult.data) {
    const { error } = await createChat(chatId);

    if (error) {
      return {
        ok: false,
        error: new Error(error?.message ?? "Error occured creating chat thread.."),
      };
    }

    threadOwnerContextResult = await getThreadOwnerContextWithClient(sb, chatId);
  }

  if (threadOwnerContextResult.error || !threadOwnerContextResult.data) {
    return {
      ok: false,
      error: threadOwnerContextResult.error ?? new Error("Thread owner not found"),
    };
  }

  const ownerId = threadOwnerContextResult.data.ownerId;

  const rows = messages
    .map((message) => convertUIMessageToMessage(message, chatId))
    .filter((message): message is Message => message !== null)
    .map((message) => encryptMessageRowContent(message, ownerId));

  const { error } = await sb.from("messages").upsert(rows, {
    ignoreDuplicates: true,
  });

  if (error) {
    logger.error("upsertMessages", `Error upserting messages: ${error?.code ?? "unknown"}`);

    return {
      ok: false,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  logger.log("upsertMessages", "Messages upserted successfully");

  return {
    ok: true,
    error: null,
  };
}

export async function getMessages(chatId: string): Promise<Result<UIMessage[]>> {
  const sb = await supabaseServer();

  const { data: messages, error: messagesErr } = await sb
    .from("messages")
    .select("*")
    .eq("thread_id", chatId)
    .order("created_at", { ascending: true });

  if (messagesErr || !messages) {
    return {
      data: null,
      error: new Error(messagesErr?.message ?? "Unknown error"),
    };
  }

  if (messages.length === 0) {
    return {
      data: [],
      error: null,
    };
  }

  const threadOwnerContext = await getThreadOwnerContextWithClient(sb, chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      data: null,
      error: threadOwnerContext.error ?? new Error("Thread owner not found"),
    };
  }

  const ownerId = threadOwnerContext.data.ownerId;

  const uiMessages = messages
    .map((message) =>
      convertMessageToUIMessage(decryptMessageRowContent(message as Message, ownerId))
    )
    .filter((message) => message !== null);

  if (uiMessages.length !== messages.length) {
    logger.error("getMessages", "A message was not converted to UIMessage");
  }

  return {
    data: uiMessages,
    error: null,
  };
}

/**
 * Returns messages in a thread on or after a given date (UTC).
 * @param chatId - Thread ID
 * @param since - ISO date string (YYYY-MM-DD); messages with created_at >= that day (00:00:00 UTC) are included
 */
export async function getMessagesSince(
  chatId: string,
  since: string
): Promise<Result<UIMessage[], string>> {
  try {
    const sb = await supabaseServer();
    const sinceTimestamp = `${since.trim()}T00:00:00.000Z`;

    const { data: messages, error } = await sb
      .from("messages")
      .select("*")
      .eq("thread_id", chatId)
      .gte("created_at", sinceTimestamp)
      .order("created_at", { ascending: true });

    if (error || !messages) {
      return {
        data: [],
        error: error?.message ?? "Unknown error",
      };
    }

    if (messages.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const threadOwnerContext = await getThreadOwnerContextWithClient(sb, chatId);

    if (threadOwnerContext.error || !threadOwnerContext.data) {
      return {
        data: [],
        error: threadOwnerContext.error?.message ?? "Thread owner not found",
      };
    }

    const ownerId = threadOwnerContext.data.ownerId;

    const uiMessages = messages
      .map((message) =>
        convertMessageToUIMessage(decryptMessageRowContent(message as Message, ownerId))
      )
      .filter((message) => message !== null);

    if (uiMessages.length !== messages.length) {
      logger.error("getMessagesSince", "A message was not converted to UIMessage");
    }

    return {
      data: uiMessages,
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function getNMessages(
  chatId: string,
  limit?: number,
  debug: boolean = false
): Promise<Result<UIMessage[], string>> {
  if (limit === 0) {
    return {
      data: [],
      error: "Limit should not be zero",
    };
  }

  try {
    const sb = await supabaseServer();

    const { data: messages, error } = await sb
      .from("messages")
      .select("*")
      .eq("thread_id", chatId)
      .order("created_at", { ascending: false })
      .limit(limit ?? DEFAULT_MESSAGE_LIMIT);

    if (error || !messages) {
      return {
        data: [],
        error: error?.message ?? "Unknown error",
      };
    }

    if (messages.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const threadOwnerContext = await getThreadOwnerContextWithClient(sb, chatId);

    if (threadOwnerContext.error || !threadOwnerContext.data) {
      return {
        data: [],
        error: threadOwnerContext.error?.message ?? "Thread owner not found",
      };
    }

    const ownerId = threadOwnerContext.data.ownerId;

    // Convert to UIMessage format and put into chronological order
    const uiMessages = messages
      .map((message) =>
        convertMessageToUIMessage(decryptMessageRowContent(message as Message, ownerId))
      )
      .filter((message) => message !== null)
      .reverse();

    if (uiMessages.length !== messages.length) {
      logger.error("getNMessages", "A message was not converted to UIMessage");
    }

    if (debug) {
      logger.log(
        "getNMessages",
        uiMessages
          .map((m, idx) => {
            const textPartCount = m.parts.filter((p) => p.type === "text").length;

            return `${idx}: role=${m.role} text_parts=${textPartCount}`;
          })
          .join("\n")
      );
    }

    return {
      data: uiMessages,
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Returns the total number of messages in a thread (for LLM context).
 */
export async function getMessageCount(chatId: string): Promise<Result<number, string>> {
  try {
    const sb = await supabaseServer();
    const { count, error } = await sb
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("thread_id", chatId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: Math.max(0, count ?? 0), error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Returns whether the thread already has a title.
 * Always reads from the DB so we never skip title generation due to stale state.
 */
export async function getThreadHasTitle(
  chatId: string,
  _options?: { knownHasTitle?: boolean }
): Promise<Result<boolean>> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("threads").select("title").eq("id", chatId).single();

  if (error) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }
  const hasTitle = data?.title != null && String(data.title).trim() !== "";

  return {
    data: hasTitle,
    error: null,
  };
}

export async function updateChatTitle(chatId: string, title: string): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const hasTitle = title.trim() !== "";
  const updatePayload: { title: string; flags?: number } = { title };
  // Set or clear HAS_TITLE bit when flags column exists (after migration)
  const { data: row, error: flagsErr } = await sb
    .from("threads")
    .select("flags")
    .eq("id", chatId)
    .single();

  if (!flagsErr && row != null) {
    updatePayload.flags = hasTitle
      ? setFlag(row.flags ?? 0, THREAD_FLAGS.HAS_TITLE)
      : clearFlag(row.flags ?? 0, THREAD_FLAGS.HAS_TITLE);
  }
  const { error } = await sb.from("threads").update(updatePayload).eq("id", chatId);

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

export async function updateChatPinned(chatId: string, pinned: boolean): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { error } = await sb.from("threads").update({ pinned }).eq("id", chatId);

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
 * Updates the thread's routing metadata used by the unified sidebar.
 * Keep values non-sensitive (thread list metadata is not encrypted).
 */
export async function updateThreadRouting(
  chatId: string,
  routing: { feature?: string; path?: string }
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const payload: { feature?: string; path?: string } = {};

  if (routing.feature != null) payload.feature = routing.feature;
  if (routing.path != null) payload.path = routing.path;

  const { error } = await sb.from("threads").update(payload).eq("id", chatId);

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

export async function deleteMessage(messageId: string): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { error } = await sb.from("messages").delete().eq("id", messageId);

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

export async function deleteChat(chatId: string): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { error } = await sb.from("threads").delete().eq("id", chatId);

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
 * Deletes a chat only if it has no messages. Use for auto-cleanup of blank chats.
 * Returns error if the chat has any messages (so we check emptiness in two places: UI + server).
 */
export async function deleteEmptyChat(chatId: string): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { data: threadMeta, error: threadMetaErr } = await sb
    .from("threads")
    .select("feature")
    .eq("id", chatId)
    .maybeSingle();

  if (threadMetaErr) {
    return {
      ok: false,
      error: new Error(threadMetaErr.message ?? "Unknown error"),
    };
  }

  if (threadMeta?.feature === "strata_agent") {
    return {
      ok: false,
      error: new Error("Strata assistant threads are not auto-deleted"),
    };
  }

  const countResult = await getMessageCount(chatId);

  if (countResult.error !== null) {
    return {
      ok: false,
      error: new Error(countResult.error),
    };
  }
  const count = countResult.data ?? 0;

  if (count > 0) {
    return {
      ok: false,
      error: new Error("Chat is not empty"),
    };
  }

  return deleteChat(chatId);
}

export async function getConversationSummary(chatId: string): Promise<Result<string>> {
  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContextWithClient(sb, chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      data: null,
      error: threadOwnerContext.error ?? new Error("Thread owner not found"),
    };
  }

  const { data, error } = await sb
    .from("thread_summaries")
    .select("summary_text")
    .eq("thread_id", chatId)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  return {
    data: decryptThreadSummaryText(data.summary_text, threadOwnerContext.data.ownerId, chatId),
    error: null,
  };
}

export async function updateConversationSummary(
  chatId: string,
  conversationSummary: string
): Promise<SimpleResult> {
  if (conversationSummary.trim().length === 0) {
    return {
      ok: false,
      error: new Error("Conversation summary cannot be empty"),
    };
  }

  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContextWithClient(sb, chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      ok: false,
      error: threadOwnerContext.error ?? new Error("Thread owner not found"),
    };
  }

  const { error } = await sb
    .from("threads")
    .update({
      conversation_summary: encryptConversationSummaryValue(
        conversationSummary,
        threadOwnerContext.data.ownerId,
        chatId
      ),
    })
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

export async function updateChatStream(params: {
  chatId: string;
  activeStreamId: string | null;
}): Promise<SimpleResult> {
  const { chatId, activeStreamId } = params;

  const sb = await supabaseServer();
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
