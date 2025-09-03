"use server";

import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  generateObject,
  generateText,
  UIMessage,
} from "ai";

import { supabaseServer } from "../supabase/server";
import { Message, ThreadSummary, ThreadSummarySchema } from "../schemas/chat";
import { ValidSummarySchema } from "../schemas/llm-tools";

import { createLogger } from "@/lib/logger";
import { convertMessageToUIMessage } from "@/lib/chat/message-transform";
import {
  getMessages,
  updateChatTitle,
  updateConversationSummary,
} from "@/data/supabase/chat";
import { Result } from "@/types";

const SummarizerSystemPrompt = `
You are Organic LLM's conversation summarizer.
Given the full set of messages in this thread, look at all of them and write a single concise paragraph (2-4 sentences) that captures:
- what the user and assistant have been working on,
- any key decisions or questions,
- and the current focus or next step.
The summary must be clear, compact, and neutral, without filler or repetition. It should be under 600 tokens.
Do not include formatting, lists, or citations — just one plain text blurb suitable for storage in a database field.
`;

const ValidatorSystemPrompt = `
You are a strict validator.
Given a conversation summary, answer valid = TRUE if it clearly includes:
  1.	The main objectives or tasks being worked on,
  2.	Any important decisions or open questions,
  3.	The current focus or next step.
Otherwise, answer valid = FALSE.
Reply with only boolean value — no explanation.

Proposed conversation summary:
{{conversationSummary}}
`;

const ReviserSystemPrompt = `
You are Organic LLM's summary reviser.
You are given:
	1.	The current summary (which is incomplete or low-quality), and
	2.	The full conversation messages.

Your task: Rewrite the summary into one concise paragraph (under 600 tokens) that clearly includes:
    - the main objectives or tasks being worked on,
    - any important decisions or open questions,
    - the current focus or next step.

The output must be clear, neutral, and compact, with no lists, no formatting, and no explanations. Output only the improved summary paragraph.

Current conversation summary:
{{conversationSummary}}
`;

const logger = createLogger(`lib/llm/chat-helpers.ts`);

export async function ensureChatHasTitle(
  chatId: string
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
      `Chat already has title: ${res.data.title}`
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
  chatId: string
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
      `Error getting message: ${messages.error?.message}`
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
      `Error updating chat title: ${res.error.message}`
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

export async function summarizeChat(
  chatId: string
): Promise<Result<string, string>> {
  logger.log("summarizeChat", `Summarizing chat ${chatId}`);
  // Get all chat messages
  let { data: messages, error } = await getMessages(chatId);

  let summaryGenerationCount = 0;

  if (error || !messages) {
    return {
      data: null,
      error: "No messages found for chat",
    };
  }

  // Safeguard for development, cap messages to 200
  if (messages.length > 75) {
    logger.warn(
      "summarizeChat",
      `Chat ${chatId} has more than 75 messages, truncating`
    );
    messages = messages.slice(-75);
  }

  const modelMessages = convertToModelMessages(messages);

  // logger.log(
  //   "summarizeChat",
  //   `Messages to be summarized\n${JSON.stringify(modelMessages)}`
  // );

  logger.log(
    "summarizeChat",
    `Summarizing chat ${chatId} with ${modelMessages.length} messages`
  );

  let { text: conversationSummary } = await generateText({
    model: openai("gpt-5-mini"),
    system: SummarizerSystemPrompt,
    temperature: 0.2,
    messages: modelMessages,
  });

  summaryGenerationCount++;

  logger.log(
    "summarizeChat",
    `Generated initial conversation summary for chat ${chatId}\nConversation Summary (v${summaryGenerationCount}): ${conversationSummary}`
  );

  // Generate conversation summary and validate result
  for (let i = 0; i < 3; i++) {
    const { object: validSummary } = await generateObject({
      model: openai("gpt-5-mini"),
      system: ValidatorSystemPrompt.replace(
        "{{conversationSummary}}",
        conversationSummary
      ),
      temperature: 0.1,
      messages: modelMessages,
      schema: ValidSummarySchema,
    });

    // If validator is satisfied with summary,
    // break and continue with current summary
    if (validSummary.valid) {
      logger.log(
        "summarizeChat",
        `Validator has approved summary v${summaryGenerationCount}`
      );
      break;
    }

    logger.log(
      "summarizeChat",
      `Validator has rejected summary v${summaryGenerationCount}\nWith response: ${JSON.stringify(validSummary)}`
    );

    let { text: updatedConversationSummary } = await generateText({
      model: openai("gpt-5-mini"),
      system: ReviserSystemPrompt.replace(
        "{{conversationSummary}}",
        conversationSummary
      ),
      temperature: 0.2,
      messages: modelMessages,
    });

    conversationSummary = updatedConversationSummary;

    logger.log(
      "summarizeChat",
      `Generated updated conversation summary for chat ${chatId}\nConversation Summary (v${summaryGenerationCount}): ${conversationSummary}`
    );
  }

  if (conversationSummary === null) {
    logger.error(
      "summarizeChat",
      "Conversation summary could not be generated."
    );

    return {
      data: null,
      error: "Conversation summary could not be generated.",
    };
  }

  const { error: sbError } = await updateConversationSummary(
    chatId,
    conversationSummary
  );

  if (sbError) {
    logger.error(
      "summarizeChat",
      "Conversation summary could not be updated.",
      sbError
    );

    return {
      data: conversationSummary,
      error: `Conversation summary could not be updated. ${sbError}`,
    };
  }

  return {
    data: conversationSummary,
    error: null,
  };
}

export async function summarizeChatNEW(
  chatId: string
): Promise<Result<string, string>> {
  logger.log("summarizeChatNEW", `Summarizing chat ${chatId}`);

  const { data: summary, error } = await summarizeChat(chatId);

  if (error || !summary) {
    return {
      data: null,
      error: error,
    };
  }

  const sb = await supabaseServer();

  // TEMPORARY OVERHEAD
  const { data: latest_message, error: messagesError } = await sb
    .from("messages")
    .select("id")
    .eq("thread_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (messagesError || !latest_message) {
    return {
      data: null,
      error: messagesError.message ?? "No latest message id found",
    };
  }

  logger.log("summarizeChatNEW", `Generated summary: ${summary}`);
  const { error: sbError } = await sb.from("thread_summaries").insert({
    thread_id: chatId,
    summary_text: summary,
    summary_tokens: summary.length,
    last_summarized_message_id: latest_message.id,
    last_summarized_at: new Date().toISOString(),
  });
  if (sbError) {
    return {
      data: null,
      error: sbError.message,
    };
  }

  return {
    data: summary,
    error: null,
  };
}

export async function updateChatSummary(
  chatId: string
): Promise<Result<string, string>> {
  logger.log("updateChatSummary", `Updating chat summary for chat ${chatId}`);
  const sb = await supabaseServer();

  const { data: threadSummaryData, error } = await sb
    .from("thread_summaries")
    .select(
      `
      *
      `
    )
    .eq("thread_id", chatId)
    .maybeSingle();

  if (error) {
    logger.error(
      "updateChatSummary",
      `Error getting thread summary: ${error.message}`
    );
    return {
      data: null,
      error: error.message,
    };
  } else if (!threadSummaryData) {
    // If no thread summary data, generate a new one
    return await summarizeChatNEW(chatId);
  }

  const threadSummary = ThreadSummarySchema.parse(threadSummaryData);

  logger.log(
    "updateChatSummary",
    `Current thread summary: ${JSON.stringify(threadSummary)}`
  );

  return {
    data: null,
    error: "Not implemented",
  };
}
