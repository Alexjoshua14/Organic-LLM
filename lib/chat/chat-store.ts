"use server";

import { UIMessage } from "ai";

import { createLogger } from "../logger";
import {
  SYSTEM_PROMPT,
  PROMETHEUS_SYSTEM_PROMPT,
} from "../system-prompt/prompt-v0";
import SPARK_SYSTEM_PROMPT from "../system-prompt";
import { getStateString } from "../supabase/organicStateStore";

import {
  createChat as createChatSupabase,
  loadChat as loadChatSupabase,
  getChats as getChatsSupabase,
  getNMessages,
  getConversationSummary,
  upsertMessages,
} from "@/data/supabase/chat";
import { Result, SimpleResult } from "@/types";
import { Thread } from "@/lib/schemas/chat";
import { searchMemories } from "../memory/operations";

const logger = createLogger(`util/chat-store.ts`);

interface getContextProps {
  chatId: string;
  limit?: number;
  persona?: "prometheus" | "spark";
  message: UIMessage;
}

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

/**
 * Saves the chat idempotently
 *
 * @param chatId - The ID of the chat to save
 * @param messages - The messages to save
 * @returns
 */
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

export async function getMessagesForChatPrompt({
  chatId,
  limit,
  persona,
}: getContextProps): Promise<
  Result<{ prompt: string; messages: UIMessage[] }, string>
> {
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

  let conversationSummary = "";

  if (conversationSummaryResult.error) {
    logger.error(
      "getMessagesForChatPrompt",
      `Error getting conversation summary: ${conversationSummaryResult.error.message}`
    );
    conversationSummary = "";
  } else if (conversationSummaryResult.data === null) {
    logger.error(
      "getMessagesForChatPrompt",
      `Error getting conversation summary: Conversation summary is null`
    );
    conversationSummary = "";
  } else {
    conversationSummary = conversationSummaryResult.data;
  }

  const prompt =
    persona === "prometheus"
      ? PROMETHEUS_SYSTEM_PROMPT
      : persona === "spark"
        ? SPARK_SYSTEM_PROMPT
        : SYSTEM_PROMPT;

  console.log("prompt", prompt);

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

export async function getContextAndMessagesChatPrompt({
  chatId,
  limit,
  persona,
}: getContextProps): Promise<
  Result<{ prompt: string; messages: UIMessage[] }, string>
> {
  const { data: messages, error } = await getNMessages(chatId, limit);

  if (error || messages === null) {
    logger.error(
      "getContextAndMessagesChatPrompt",
      `Error getting messages: ${error}`
    );

    return {
      data: null,
      error: error,
    };
  }

  let ctx = "";

  if (persona === "spark") {
    logger.log("getContextAndMessagesChatPrompt", "Getting context for Spark");
    try {
      const ctxResult = await getStateString(chatId);

      ctx = ctxResult;
    } catch (error) {
      logger.error(
        "getContextAndMessagesChatPrompt",
        `Error getting context: ${error}`
      );
    }
  }

  let conversationSummary = "";

  const conversationSummaryResult = await getConversationSummary(chatId);

  if (conversationSummaryResult.error) {
    logger.error(
      "getContextAndMessagesChatPrompt",
      `Error getting conversation summary: ${conversationSummaryResult.error.message}`
    );
    conversationSummary = "";
  } else if (conversationSummaryResult.data === null) {
    logger.error(
      "getContextAndMessagesChatPrompt",
      `Error getting conversation summary: Conversation summary is null`
    );
    conversationSummary = "";
  } else {
    conversationSummary = conversationSummaryResult.data;
  }

  const prompt =
    persona === "prometheus"
      ? PROMETHEUS_SYSTEM_PROMPT
      : persona === "spark"
        ? `${SPARK_SYSTEM_PROMPT}\n\n${ctx}\n\nConversation Summary:\n${conversationSummary}`
        : `${SYSTEM_PROMPT}\n\nConversation Summary:\n${conversationSummary}`;

  // Common for all prompts
  const systemPrompt = prompt.replace(
    "{{currentDateTime}}",
    new Date().toISOString()
  );

  return {
    data: {
      prompt: systemPrompt,
      messages,
    },
    error: null,
  };
}

/****************************
 * LATEST VERSION (11/10/25)
 *
 * This version will be centralize all context gathering logic
 * This will grab messages from supabase, persona from wherever, and memories from mem0
 *
 * This will be async where possible to parallelize pieces and avoid wait delays
 *
 ******************************/
/**
 * Gathers the relevant context pieces for LLM query.
 * Includes:
 *  - System prompt
 *  - Latest Messages, not including current message
 *  - Relevant memories
 *
 * Notes:
 *  - Ensure static pieces are placed on the top to enable better caching
 *  - Start longer awaits earlier
 *
 *
 * @param chatId - The ID of the chat to get context for
 * @param message - The user's current message being sent to LLM
 * @param persona - The persona of the chat (prometheus or spark)
 * @returns - Context
 * @returns - Latest messages
 */
export async function getContext({
  chatId,
  limit,
  persona,
  message,
}: getContextProps): Promise<
  Result<{ context: string; messages: UIMessage[] }, string>
> {
  const startContextCompilationTime = performance.now();

  try {
    /***
     * Step 1
     *
     * Get Latest n Messages from Supabase
     ***/
    const messagesPromise = getNMessages(chatId, limit);

    /***
     * Step 2
     *
     * Get Conversation Summary from Supabase
     */

    const conversationSummaryPromise = getConversationSummary(chatId);

    /***
     * Step 3
     *
     * Get Memories from Mem0
     ***/
    const userMessage = message.parts
      .filter((part) => part.type === "text")
      .reduce((acc, part) => acc + part.text, "");
    logger.log("getContext", `User message: ${userMessage}`);
    const memoriesPromise = searchMemories(userMessage, "test-user"); // TODO: Get user ID from Supabase

    /***
     * Step 4
     *
     * Get Persona from wherever
     *
     ***/
    let systemPrompt = "";
    switch (persona) {
      case "prometheus":
        systemPrompt = PROMETHEUS_SYSTEM_PROMPT;
        break;
      case "spark":
        systemPrompt = SPARK_SYSTEM_PROMPT;
        break;
      default:
        systemPrompt = SYSTEM_PROMPT;
        break;
    }

    /***
     * Step 5
     *
     * Await and combine context from all places
     ***/

    /**
     * Structure:
     *  - System prompt
     *  - Conversation summary
     *  - Memories
     */

    const [messagesResult, conversationSummaryResult, memoriesResult] =
      await Promise.all([
        messagesPromise,
        conversationSummaryPromise,
        memoriesPromise,
      ]);

    /***
     * Step 5a
     *
     * Handle message errors
     */
    let messages: UIMessage[] = [];
    if (messagesResult.error) {
      logger.error(
        "getContext",
        `Error getting messages: ${messagesResult.error}`
      );
    }
    messages = messagesResult.data ?? [];

    /***
     * Step 5b
     *
     * Handle conversation summary errors
     */

    let conversationSummary = "";
    if (conversationSummaryResult.error) {
      logger.error(
        "getContext",
        `Error getting conversation summary: ${conversationSummaryResult.error}`
      );
    }
    conversationSummary = conversationSummaryResult.data ?? "";

    /***
     * Step 5c
     *
     * Handle memories errors
     */
    let memories = "";
    if (memoriesResult.results === null) {
      logger.error(
        "getContext",
        `Error getting memories: Memories are null\n${JSON.stringify(memoriesResult)}`
      );
    }

    memories =
      memoriesResult.results?.map((result) => result.memory).join("\n") ?? "";

    /***
     * Step 5d
     *
     * Combine context
     ***/
    const context = `${systemPrompt}\n\nConversation Summary:\n${conversationSummary}\n\nMemories:\n${memories}`;

    return {
      data: {
        context,
        messages,
      },
      error: null,
    };
  } catch (error) {
    logger.error("getContext", `Error getting context: ${error}`);
    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    const endContextCompilationTime = performance.now();
    logger.log(
      "getContext",
      `Context compilation time: ${endContextCompilationTime - startContextCompilationTime} milliseconds`
    );
  }
}
