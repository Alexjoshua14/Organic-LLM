"use server";

import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  generateObject,
  generateText,
  ModelMessage,
} from "ai";
import z from "zod";

import { supabaseServer } from "../supabase/server";
import { Message, ThreadSummarySchema } from "../schemas/chat";
import { ValidSummary, ValidSummarySchema } from "../schemas/llm-tools";

import { createLogger } from "@/lib/logger";
import { convertMessageToUIMessage } from "@/lib/chat/message-transform";
import {
  getMessages,
  updateChatTitle,
  updateConversationSummary,
} from "@/data/supabase/chat";
import { Result } from "@/types";

const MODEL_SELECTION = {
  summarizer: openai("gpt-5"),
  updater: openai("gpt-5"),
  validator: openai("gpt-5-mini"),
  reviser: openai("gpt-5-mini"),
  tokenEstimator: openai("gpt-5-nano"),
};

const SummarizerSystemPrompt = `
You are Organic LLM's summarizer. 
Summarize the entire conversation into ONE clear paragraph (2–4 sentences, under 600 tokens). 
Include: main objectives/tasks, important decisions or open questions, and the current focus/next step. 
Be concise, neutral, and free of lists, formatting, or citations. Output plain text only.
`;

const UpdateSummarizerSystemPrompt = `
You are Organic LLM's summarizer. 
Update the previous summary by integrating NEW messages since it was last written. 
Produce ONE clear paragraph (2–4 sentences, under 600 tokens) that preserves all key details from the prior summary while adding new information. 
Include: objectives/tasks, decisions or questions, and current focus/next step. 
Be concise, neutral, and output plain text only.

Previous summary:
{{conversationSummary}}
`;

const ValidatorSystemPrompt = `
You are a strict validator. 
Given a proposed conversation summary, return valid = TRUE if it clearly includes:
1. Main objectives or tasks, 
2. Important decisions or open questions, 
3. Current focus or next step. 
Otherwise return valid = FALSE. 
Reply only with the boolean value and a short reason for the validity of the summary.

Proposed summary:
{{conversationSummary}}
Current persisted summary (if any):
{{currentPersistedConversationSummary}}
`;

const ReviserSystemPrompt = `
You are Organic LLM's summary reviser. 
Rewrite the current summary into ONE concise paragraph (2–4 sentences, under 600 tokens). 
It must include: objectives/tasks, important decisions or open questions, and the current focus/next step. 
Be clear, compact, neutral, and output plain text only—no lists or formatting.

Current summary:
{{conversationSummary}}

Reason for invalidity:
{{reason}}

Previous persisted summary (if any):
{{currentPersistedConversationSummary}}
`;

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
    model: MODEL_SELECTION.tokenEstimator,
    system: `
    You are a helpful assistant that generates a summary of a chat.
    The chat messages will be provided to you.
    Generate a summary of the chat.
    `,
    messages: convertToModelMessages(uiMessages),
  });

  const { text: titleIdea } = await generateText({
    model: MODEL_SELECTION.summarizer,
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

export async function summarizeChat(
  chatId: string,
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
      `Chat ${chatId} has more than 75 messages, truncating`,
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
    `Summarizing chat ${chatId} with ${modelMessages.length} messages`,
  );

  let { text: conversationSummary } = await generateText({
    model: MODEL_SELECTION.summarizer,
    system: SummarizerSystemPrompt,
    temperature: 0.2,
    messages: modelMessages,
  });

  summaryGenerationCount++;

  logger.log(
    "summarizeChat",
    `Generated initial conversation summary for chat ${chatId}\n`,
    //`Conversation Summary (v${summaryGenerationCount}): ${conversationSummary}`,
  );

  const validatedSummaryRes = await validateSummary(
    conversationSummary,
    modelMessages,
  );

  if (validatedSummaryRes.error || !validatedSummaryRes.data) {
    return {
      data: null,
      error: validatedSummaryRes.error,
    };
  }

  conversationSummary = validatedSummaryRes.data;

  if (conversationSummary === null) {
    logger.error(
      "summarizeChat",
      "Conversation summary could not be generated.",
    );

    return {
      data: null,
      error: "Conversation summary could not be generated.",
    };
  }

  const { error: sbError } = await updateConversationSummary(
    chatId,
    conversationSummary,
  );

  if (sbError) {
    logger.error(
      "summarizeChat",
      "Conversation summary could not be updated.",
      sbError,
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

export async function summarizeNewChat(
  chatId: string,
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

  let tokens = await estimateTokenCount(summary);

  if (tokens === null) {
    tokens = 600;
  }

  // logger.log("summarizeChatNEW", `Generated summary: ${summary}`);
  const { error: sbError } = await sb.from("thread_summaries").insert({
    thread_id: chatId,
    summary_text: summary,
    summary_tokens: tokens,
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
  chatId: string,
): Promise<Result<string, string>> {
  logger.log("updateChatSummary", `Updating chat summary for chat ${chatId}`);
  const sb = await supabaseServer();

  const { data: threadSummaryData, error } = await sb
    .from("thread_summaries")
    .select(
      `
      *
      `,
    )
    .eq("thread_id", chatId)
    .maybeSingle();

  if (error) {
    logger.error(
      "updateChatSummary",
      `Error getting thread summary: ${error.message}`,
    );

    return {
      data: null,
      error: error.message,
    };
  } else if (!threadSummaryData) {
    // If no thread summary data, generate a new one
    return await summarizeNewChat(chatId);
  }

  const threadSummary = ThreadSummarySchema.parse(threadSummaryData);

  // logger.log(
  //   "updateChatSummary",
  //   `Current thread summary: ${JSON.stringify(threadSummary)}`,
  // );

  const latestMessageRes = await sb
    .from("messages")
    .select("created_at")
    .eq("id", threadSummary.last_summarized_message_id)
    .single();

  if (latestMessageRes.error) {
    return {
      data: null,
      error: latestMessageRes.error.message,
    };
  }

  const messagesRes = await sb
    .from("messages")
    .select("*")
    .eq("thread_id", chatId)
    .filter("created_at", "gt", latestMessageRes.data.created_at)
    .order("created_at", { ascending: false });

  logger.log(
    "updateChatSummary",
    `Messages since latest message: ${messagesRes.data?.length ?? 0} messages`,
  );

  if (messagesRes.data?.length === 0) {
    logger.log("updateChatSummary", `No messages found since latest message`);

    return {
      data: null,
      error: "No messages found since latest message",
    };
  }

  if (messagesRes.error || !messagesRes.data) {
    logger.error(
      "updateChatSummary",
      `Error getting messages: ${messagesRes.error.message}`,
    );

    return {
      data: null,
      error: messagesRes.error.message ?? "No messages found",
    };
  }

  const uiMessages = messagesRes.data
    .map((message) => convertMessageToUIMessage(message))
    .filter((message) => message !== null);

  if (uiMessages.length !== messagesRes.data.length) {
    logger.error(
      "updateChatSummary",
      "A message was not converted to UIMessage",
    );
  }

  const modelMessages = convertToModelMessages(uiMessages);

  const { text: updatedSummary } = await generateText({
    model: MODEL_SELECTION.updater,
    system: UpdateSummarizerSystemPrompt.replace(
      "{{conversationSummary}}",
      threadSummary.summary_text,
    ),
    temperature: 0.3,
    messages: modelMessages,
  });

  // logger.log("updateChatSummary", `Updated summary: ${updatedSummary}`);

  const validatedSummaryRes = await validateSummary(
    updatedSummary,
    modelMessages,
  );

  if (validatedSummaryRes.error) {
    return {
      data: null,
      error: validatedSummaryRes.error,
    };
  }

  // logger.log(
  //   "updateChatSummary",
  //   `Validated summary: ${validatedSummaryRes.data}`
  // );

  if (!validatedSummaryRes.data) {
    return {
      data: null,
      error: "No validated summary",
    };
  }

  const tokens = await estimateTokenCount(validatedSummaryRes.data ?? "");

  if (tokens === null) {
    return {
      data: null,
      error: "Failed to estimate tokens",
    };
  }

  logger.log("updateChatSummary", `Estimated tokens: ${tokens}`);

  const { error: sbError } = await sb
    .from("thread_summaries")
    .update({
      summary_text: validatedSummaryRes.data,
      summary_tokens: tokens,
      last_summarized_message_id: messagesRes.data[0].id,
      last_summarized_at: new Date().toISOString(),
    })
    .eq("thread_id", chatId);

  if (sbError) {
    return {
      data: null,
      error: sbError.message,
    };
  }

  return {
    data: validatedSummaryRes.data,
    error: null,
  };
}

/**
 * Validates a conversation summary by generating an object with a valid property.
 * The validator will be given the current summary and the messages since the last summary was generated.
 * The validator will then generate a new summary and validate it.
 * This will be repeated 3 times.
 * If the validator is satisfied with the summary, the summary will be returned.
 * If the validator is not satisfied with the summary, the summary will be revised and validated again.
 *
 * @param conversationSummary - The conversation summary to validate
 * @param messages - Messages to use for context
 * @returns The validated summary
 */
const validateSummary = async (
  conversationSummary: string,
  messages: ModelMessage[],
  currentPersistedConversationSummary?: string,
  forceGeneration?: boolean,
): Promise<Result<string, string>> => {
  let validSummary: ValidSummary | null = null;

  // Generate conversation summary and validate result
  for (let i = 1; i <= 3; i++) {
    const validatorRes = await generateObject({
      model: MODEL_SELECTION.validator,
      system: ValidatorSystemPrompt.replace(
        "{{currentPersistedConversationSummary}}",
        currentPersistedConversationSummary ?? "null",
      ).replace("{{conversationSummary}}", conversationSummary),
      temperature: 0.1,
      messages: messages,
      schema: ValidSummarySchema,
    });

    validSummary = validatorRes.object;

    // If validator is satisfied with summary,
    // break and continue with current summary
    if (validSummary.valid) {
      logger.log("validateSummary", `Validator has approved summary v${i}`);
      break;
    }

    logger.log(
      "validateSummary",
      `Validator has rejected summary v${i}\nWith response: ${JSON.stringify(validSummary)}`,
    );

    let { text: updatedConversationSummary } = await generateText({
      model: MODEL_SELECTION.reviser,
      system: ReviserSystemPrompt.replace(
        "{{conversationSummary}}",
        conversationSummary,
      )
        .replace(
          "{{currentPersistedConversationSummary}}",
          currentPersistedConversationSummary ?? "null",
        )
        .replace("{{reason}}", validSummary.reason),
      temperature: 0.2,
      messages: messages,
    });

    conversationSummary = updatedConversationSummary;

    // logger.log(
    //   "validateSummary",
    //   `\nConversation Summary (v${i}): ${conversationSummary}`
    // );
  }

  // If we're allowing validator to fail to provide valid summary
  // and we don't get an approved summary, return null
  if (!forceGeneration) {
    if (!validSummary?.valid) {
      return {
        data: null,
        error: "Validator failed to provide valid summary",
      };
    }
  }

  return {
    data: conversationSummary,
    error: null,
  };
};

export const estimateTokenCount = async (text: string) => {
  const schema = z.object({
    tokens: z.number().max(100000),
  });

  const res = await generateObject({
    model: MODEL_SELECTION.tokenEstimator,
    system: `
    You are a helpful assistant that estimates the token count of a given text.
    Estimate the token count of the given text.
    Return only the token count, no other text.
    `,
    prompt: text,
    schema: schema,
  });

  if (res.finishReason === "error" || !res.object) {
    return null;
  }

  return res.object.tokens;
};
