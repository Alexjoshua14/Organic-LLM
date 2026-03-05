"use server";

import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "./profiles";

import { Thread, ThreadSchema } from "@/lib/schemas/chat";
import { Result, SimpleResult } from "@/types";
import {
  decodeThreadFlags,
  setFlag,
  THREAD_FLAGS,
} from "@/lib/thread-flags";
import {
  convertMessageToUIMessage,
  convertUIMessageToMessage,
} from "@/lib/chat/message-transform";
import { supabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("data/supabase/chat.ts");

const DEFAULT_MESSAGE_LIMIT = 10;

/**
 * Needs to run with local user credentials, can not use service id
 */
export async function getChats(): Promise<Result<Thread[]>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("id, title, owner_id, created_at, updated_at, pinned")
    .order("updated_at", { ascending: false });

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
  chatId: string,
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

  // Check if Chat thread exists
  const { data: thread, error: threadErr } = await sb
    .from("threads")
    .select("*")
    .eq("id", chatId)
    .single();

  if (threadErr || !thread) {
    const { error } = await createChat(chatId);

    if (error) {
      return {
        ok: false,
        error: new Error(
          error?.message ?? "Error occured creating chat thread..",
        ),
      };
    }
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

  const rows = tail
    .map((message) => convertUIMessageToMessage(message, chatId))
    .filter((message) => message !== null);

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
export async function addMessage(
  threadId: string,
  message: UIMessage,
): Promise<SimpleResult> {
  const supabaseMessage = convertUIMessageToMessage(message, threadId);

  if (!supabaseMessage) {
    return {
      ok: false,
      error: new Error("Invalid message"),
    };
  }

  const sb = await supabaseServer();

  const { error } = await sb.from("messages").insert(supabaseMessage);

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

export async function upsertMessages(params: {
  chatId: string;
  messages: UIMessage[];
}): Promise<SimpleResult> {
  const { chatId, messages } = params;

  const sb = await supabaseServer();

  // Check if Chat thread exists
  const { data: thread, error: threadErr } = await sb
    .from("threads")
    .select("*")
    .eq("id", chatId)
    .single();

  if (threadErr || !thread) {
    const { error } = await createChat(chatId);

    if (error) {
      return {
        ok: false,
        error: new Error(
          error?.message ?? "Error occured creating chat thread..",
        ),
      };
    }
  }

  const rows = messages.map((message) =>
    convertUIMessageToMessage(message, chatId),
  );

  const { error } = await sb.from("messages").upsert(rows, {
    ignoreDuplicates: true,
  });

  if (error) {
    logger.error("upsertMessages", "Error upserting messages:", error);

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

export async function getMessages(
  chatId: string,
): Promise<Result<UIMessage[]>> {
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

  const uiMessages = messages
    .map((message) => convertMessageToUIMessage(message))
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
  since: string,
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

    const uiMessages = messages
      .map((message) => convertMessageToUIMessage(message))
      .filter((message) => message !== null);

    if (uiMessages.length !== messages.length) {
      logger.error(
        "getMessagesSince",
        "A message was not converted to UIMessage",
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

export async function getNMessages(
  chatId: string,
  limit?: number,
  debug: boolean = false,
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

    // Convert to UIMessage format and put into chronological order
    const uiMessages = messages
      .map((message) => convertMessageToUIMessage(message))
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
            const text = m.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join(" ");
            const trimmed = text.length > 40 ? text.slice(0, 40) + "..." : text;
            return `${idx}: ${trimmed}`;
          })
          .join("\n"),
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
export async function getMessageCount(
  chatId: string,
): Promise<Result<number, string>> {
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
 * Use this to skip ensureChatHasTitle when true (e.g. once per request).
 * Uses only the title column so it works before/without the flags migration.
 */
export async function getThreadHasTitle(
  chatId: string,
): Promise<Result<boolean>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("title")
    .eq("id", chatId)
    .single();

  if (error) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }
  const hasTitle =
    data?.title != null && String(data.title).trim() !== "";
  return {
    data: hasTitle,
    error: null,
  };
}

export async function updateChatTitle(
  chatId: string,
  title: string,
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const updatePayload: { title: string; flags?: number } = { title };
  // Set HAS_TITLE bit when flags column exists (after migration)
  const { data: row, error: flagsErr } = await sb
    .from("threads")
    .select("flags")
    .eq("id", chatId)
    .single();
  if (!flagsErr && row != null) {
    updatePayload.flags = setFlag(row.flags ?? 0, THREAD_FLAGS.HAS_TITLE);
  }
  const { error } = await sb
    .from("threads")
    .update(updatePayload)
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

export async function updateChatPinned(
  chatId: string,
  pinned: boolean,
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { error } = await sb
    .from("threads")
    .update({ pinned })
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

export async function getConversationSummary(
  chatId: string,
): Promise<Result<string>> {
  const sb = await supabaseServer();
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
    data: data.summary_text,
    error: null,
  };
}

export async function updateConversationSummary(
  chatId: string,
  conversationSummary: string,
): Promise<SimpleResult> {
  if (conversationSummary.trim().length === 0) {
    return {
      ok: false,
      error: new Error("Conversation summary cannot be empty"),
    };
  }

  const sb = await supabaseServer();

  const { error } = await sb
    .from("threads")
    .update({ conversation_summary: conversationSummary })
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
