"use server";

import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "./profiles";

import { Thread, ThreadSchema } from "@/lib/schemas/chat";
import { Result, SimpleResult } from "@/types";
import {
  convertMessageToUIMessage,
  convertUIMessageToMessage,
} from "@/lib/chat/message-transform";
import { supabaseServer } from "@/lib/supabase/server";

export async function getChats(): Promise<Result<Thread[]>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("id, title, owner_id, created_at, updated_at, pinned");

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
    console.error("A message was not converted to supabase message");
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
    console.error("A message was not converted to UIMessage");
  }

  return {
    data: uiMessages,
    error: null,
  };
}

export async function updateChatTitle(
  chatId: string,
  title: string,
): Promise<SimpleResult> {
  const sb = await supabaseServer();
  const { error } = await sb.from("threads").update({ title }).eq("id", chatId);

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
