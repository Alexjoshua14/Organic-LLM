"use server";

import { UIMessage } from "ai";

import { createLogger } from "../logger";

import {
  createChat as createChatSupabase,
  loadChat as loadChatSupabase,
  saveChat as saveChatSupabase,
  getChats as getChatsSupabase,
  getNMessages,
  getConversationSummary,
  upsertMessages,
} from "@/data/supabase/chat";
import { Result, SimpleResult } from "@/types";
import { Thread } from "@/lib/schemas/chat";
import { SYSTEM_PROMPT } from "../system-prompt/prompt-v0";

const logger = createLogger(`util/chat-store.ts`);

export async function createChat(): Promise<Result<string>> {
  const res = await createChatSupabase();

  if (res.error) {
    logger.error("createChat", `Error creating chat: ${res.error.message}`);
  } else if (res.data === null) {
    logger.error("createChat", "Error creating chat: Chat ID is null");

    return {
      data: null,
      error: new Error("Chat ID is null"),
    };
  }
  logger.log("createChat", `Chat created: ${res.data}`);

  return res;
}

export async function loadChat(
  id: string
): Promise<Result<{ thread: Thread; messages: UIMessage[] }>> {
  const res = await loadChatSupabase(id);

  if (res.error) {
    logger.error("loadChat", `Error loading chat: ${res.error.message}`);

    return {
      data: null,
      error: new Error(res.error.message),
    };
  }
  logger.log(
    "loadChat",
    `Chat loaded: ${res.data?.thread.id}, ${res.data?.messages.length} messages`
  );

  return res;
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<SimpleResult> {
  const res = await upsertMessages({ chatId, messages });

  if (res.error || !res.ok) {
    logger.error(
      "saveChat",
      `Error saving chat: ${res.error?.message ?? "Unknown error"}`
    );
  }
  logger.log("saveChat", `Chat saved: ${chatId}`);

  return res;
}

/**
 *
 * @returns List of chats
 */
export async function getChats(): Promise<Result<Thread[]>> {
  const res = await getChatsSupabase();

  if (res.error) {
    logger.error("getChats", `Error getting chats: ${res.error.message}`);

    return {
      data: null,
      error: new Error(res.error.message),
    };
  }

  return res;
}

export async function getChat(
  chatId: string
): Promise<Result<{ thread: Thread; messages: UIMessage[] }>> {
  const chat = await loadChat(chatId);

  if (chat.error) {
    logger.error("getChat", `Error getting chat: ${chat.error.message}`);

    return {
      data: null,
      error: new Error(chat.error.message),
    };
  } else {
    logger.log("getChat", `Chat loaded: ${chat.data?.thread.id}`);
  }

  return chat;
}

export async function getMessagesForChatPrompt(
  chatId: string,
  limit?: number
): Promise<Result<{ prompt: string; messages: UIMessage[] }, string>> {
  const { data: messages, error } = await getNMessages(chatId, limit);

  if (error || messages === null) {
    logger.error(
      "getMessagesForChatPrompt",
      `Error getting messages: ${error}`
    );

    return {
      data: null,
      error: error,
    };
  }

  const conversationSummaryResult = await getConversationSummary(chatId);

  if (conversationSummaryResult.error) {
    logger.error(
      "getMessagesForChatPrompt",
      `Error getting conversation summary: ${conversationSummaryResult.error.message}`
    );
    return {
      data: null,
      error: conversationSummaryResult.error.message,
    };
  }

  const conversationSummary = conversationSummaryResult.data;

  const prompt = SYSTEM_PROMPT;

  const systemPrompt = prompt
    .replace("{{currentDateTime}}", new Date().toISOString())
    .concat(`\n\nConversation Summary:\n${conversationSummary}`);

  return {
    data: {
      prompt: systemPrompt,
      messages,
    },
    error: null,
  };
}
