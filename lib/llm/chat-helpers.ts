"use server";

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, generateText } from "ai";

import { supabaseServer } from "../supabase/server";
import { Message } from "../schemas/chat";

import { createLogger } from "@/lib/logger";
import { convertMessageToUIMessage } from "@/lib/chat/message-transform";
import { updateChatTitle } from "@/data/supabase/chat";
import { Result } from "@/types";

const logger = createLogger(`lib/llm/chat-helpers.ts`);

export async function ensureChatHasTitle(
  chatId: string,
): Promise<Result<string>> {
  const sb = await supabaseServer();

  logger.log("ensureChatHasTitle", `Ensuring chat has title: ${chatId}`);

  const res = await sb
    .from("threads")
    .select("title")
    .eq("id", chatId)
    .single();

  if (res.error) {
    return {
      data: null,
      error: new Error(res.error?.message ?? "Unknown error"),
    };
  }

  if (
    res.data?.title !== null &&
    res.data?.title.trim() !== "" &&
    res.data?.title !== undefined
  ) {
    logger.log(
      "ensureChatHasTitle",
      `Chat already has title: ${res.data.title}`,
    );

    return {
      data: res.data.title,
      error: null,
    };
  }
  logger.log("ensureChatHasTitle", `Chat does not have title: ${chatId}`);

  return await generateChatTitle(chatId);
}

export async function generateChatTitle(
  chatId: string,
): Promise<Result<string>> {
  const sb = await supabaseServer();

  const messages = await sb
    .from("messages")
    .select("*")
    .eq("thread_id", chatId)
    .order("created_at", { ascending: false });

  if (messages.error) {
    logger.error(
      "updateChatTitle",
      `Error getting message: ${messages.error?.message}`,
    );

    return {
      data: null,
      error: new Error(messages.error?.message ?? "Unknown error"),
    };
  }

  const uiMessages = messages.data
    .map((message) => convertMessageToUIMessage(message as Message))
    .filter((message) => message !== null);

  if (uiMessages.length === 0) {
    logger.error("updateChatTitle", `No messages found for chat: ${chatId}`);

    return {
      data: null,
      error: new Error("No messages found for chat"),
    };
  }

  const { text: conversationSummary } = await generateText({
    model: openai("gpt-5-nano"),
    system: `
    You are a helpful assistant that generates a summary of a chat.
    The chat messages will be provided to you.
    Generate a summary of the chat.
    `,
    messages: convertToModelMessages(uiMessages),
  });

  const { text: titleIdea } = await generateText({
    model: openai("gpt-5-mini"),
    system: `
    You are a helpful assistant that generates a title for a chat.
    Generate a title for the chat based on the conversation summary.
    The title should be no more than 20 characters.
    But can be up to 40 characters if truly necessary.
    Return only the title, no other text.
    `,
    prompt: conversationSummary,
  });

  const res = await updateChatTitle(chatId, titleIdea);

  if (res.error) {
    logger.error(
      "updateChatTitle",
      `Error updating chat title: ${res.error.message}`,
    );

    return {
      data: null,
      error: new Error(res.error.message),
    };
  }

  return {
    data: titleIdea,
    error: null,
  };
}
