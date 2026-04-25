"use server";

import {
  convertToModelMessages,
  generateObject,
  generateText,
  LanguageModel,
  ModelMessage,
  type UIMessage,
} from "ai";
import { encodingForModel } from "js-tiktoken";

import { supabaseServer } from "../supabase/server";
import { Message, ThreadSummarySchema } from "../schemas/chat";
import { ValidSummary, ValidSummarySchema } from "../schemas/llm-tools";
import { decryptFromStorage, encryptForStorage } from "../crypto/message-encryption";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { convertMessageToUIMessage } from "@/lib/chat/message-transform";
import {
  getMessages,
  getThreadOwnerContext,
  updateChatTitle,
  updateConversationSummary,
} from "@/data/supabase/chat";
import { Result } from "@/types";
import { recordLlmCall } from "@/lib/llm/metrics";
import { generateShortTitleFromSummary } from "@/lib/llm/short-title-from-summary";
import { TITLE_PIPELINE_SUMMARIZER_MODEL } from "@/lib/llm/title-models";

/** Model Selections: Each ZDR compatible */
const MODEL_SELECTION: Record<string, LanguageModel> = {
  summarizer: TITLE_PIPELINE_SUMMARIZER_MODEL,
  updater: "google/gemini-3-flash",
  validator: "google/gemini-3-flash",
  reviser: "google/gemini-3-flash",
};

/** Max input tokens for title generation (allows long-thread context). */
const CHAT_TITLE_MAX_INPUT_TOKENS = 100_000;

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

/**
 * Gemini 3 requires thought_signature on functionCall parts when replaying history.
 * When we don't have one (e.g. stored messages from another model or gateway), we can use
 * this sentinel so the API skips validation. See:
 * https://ai.google.dev/gemini-api/docs/thought-signatures
 */
const GEMINI_SKIP_THOUGHT_SIGNATURE = "skip_thought_signature_validator";

/**
 * Ensures every tool-invocation part has a thoughtSignature so Gemini 3 accepts the request.
 * Use when sending UIMessages that may contain tool calls to Gemini (e.g. summarizer).
 * If the gateway does not forward this field, use convertToolCallsToTextForSummarizer instead.
 */
function ensureThoughtSignaturesForGemini(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: (msg.parts ?? []).map((part) => {
      if (part.type === "tool-invocation") {
        return {
          ...part,
          thoughtSignature:
            (part as { thoughtSignature?: string }).thoughtSignature ??
            GEMINI_SKIP_THOUGHT_SIGNATURE,
        };
      }

      return part;
    }),
  }));
}

/** Max length for tool result snippet in converted text (avoid huge payloads). */
const TOOL_RESULT_TEXT_MAX_LEN = 600;

/**
 * Converts tool-invocation parts to text parts so the summarizer sees tool semantics
 * without sending structured functionCall parts (avoids Gemini thought_signature requirement).
 * Preserves: tool name, args, and result/error in plain text.
 */
function convertToolCallsToTextForSummarizer(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    const parts = msg.parts ?? [];
    const newParts: Array<{ type: "text"; text: string }> = [];

    for (const part of parts) {
      if (part.type === "text" && "text" in part) {
        newParts.push({ type: "text", text: (part as { text: string }).text });
        continue;
      }
      if (part.type === "tool-invocation" || (part.type && String(part.type).startsWith("tool-"))) {
        const p = part as unknown as {
          toolName?: string;
          toolCallId?: string;
          args?: unknown;
          input?: unknown;
          state: string;
          result?: unknown;
          output?: unknown;
          errorText?: string;
        };
        const name = p.toolName ?? p.toolCallId ?? "tool";
        const argsLike = p.args ?? p.input;
        const argsStr = argsLike !== undefined ? JSON.stringify(argsLike) : "";
        let snippet = `[Tool: ${name}${argsStr ? ` with args: ${argsStr}` : ""}.`;
        const resultLike = p.result ?? p.output;

        if (p.state === "result" && resultLike !== undefined) {
          const resultStr =
            typeof resultLike === "string" ? resultLike : JSON.stringify(resultLike);

          snippet += ` Result: ${resultStr.slice(0, TOOL_RESULT_TEXT_MAX_LEN)}${resultStr.length > TOOL_RESULT_TEXT_MAX_LEN ? "…" : ""}`;
        } else if (p.state === "output-error" && p.errorText) {
          snippet += ` Error: ${p.errorText.slice(0, 200)}`;
        } else {
          snippet += ` State: ${p.state}`;
        }
        snippet += "]";
        newParts.push({ type: "text", text: snippet });
      }
    }

    if (newParts.length === 0) {
      return { ...msg, parts: [{ type: "text" as const, text: "" }] };
    }

    return { ...msg, parts: newParts };
  });
}

function decryptMessageForThread(message: Message, ownerId: string): Message {
  return {
    ...message,
    content: decryptFromStorage(String(message.content), {
      userId: ownerId,
      threadId: message.thread_id,
      fieldName: "messages.content",
    }),
  };
}

function encryptThreadSummary(summaryText: string, ownerId: string, chatId: string) {
  return encryptForStorage(summaryText, {
    userId: ownerId,
    threadId: chatId,
    fieldName: "thread_summaries.summary_text",
  });
}

function decryptThreadSummary(summaryText: string, ownerId: string, chatId: string) {
  return decryptFromStorage(summaryText, {
    userId: ownerId,
    threadId: chatId,
    fieldName: "thread_summaries.summary_text",
  });
}

/** Extract plain text from a UIMessage for token estimation. */
function getMessageTextForTokenEstimate(message: UIMessage): string {
  const parts = message.parts ?? [];
  const text = parts
    .map((p) => (p.type === "text" && "text" in p ? (p as { text: string }).text : ""))
    .join("");
  const role = message.role ?? "user";

  return `${role}: ${text}`;
}

/**
 * Trim messages to fit within a token budget, keeping the most recent (relevant for title).
 * Chronological order = oldest first; we keep the tail that fits.
 * Uses tiktoken (cl100k_base) for token counting.
 */
function trimMessagesToTokenBudget(
  chronologicalMessages: UIMessage[],
  maxTokens: number
): UIMessage[] {
  if (chronologicalMessages.length === 0) return [];
  const encoding = encodingForModel("gpt-5");
  let total = 0;
  let startIndex = chronologicalMessages.length;

  // Walk from newest (end) backward, counting tokens until we'd exceed budget
  for (let i = chronologicalMessages.length - 1; i >= 0; i--) {
    const text = getMessageTextForTokenEstimate(chronologicalMessages[i]);
    const n = encoding.encode(text).length;

    if (total + n > maxTokens) break;
    total += n;
    startIndex = i;
  }

  return chronologicalMessages.slice(startIndex);
}

export async function ensureChatHasTitle(chatId: string): Promise<Result<string>> {
  const sb = await supabaseServer();

  logger.log("ensureChatHasTitle", `Ensuring chat has title: ${chatId}`);

  const res = await sb.from("threads").select("title").eq("id", chatId).single();

  if (res.error) {
    return {
      data: null,
      error: new Error(res.error?.message ?? "Unknown error"),
    };
  }

  const hasTitle = res.data?.title != null && String(res.data.title).trim() !== "";

  if (hasTitle) {
    logger.log("ensureChatHasTitle", `Chat already has title: ${res.data!.title}`);

    return {
      data: String(res.data!.title).trim(),
      error: null,
    };
  }
  logger.log("ensureChatHasTitle", `Chat does not have title: ${chatId}`);

  return await generateChatTitle(chatId);
}

export async function generateChatTitle(chatId: string): Promise<Result<string>> {
  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      data: null,
      error: threadOwnerContext.error ?? new Error("Thread owner not found"),
    };
  }

  const ownerId = threadOwnerContext.data.ownerId;

  const messages = await sb
    .from("messages")
    .select("*")
    .eq("thread_id", chatId)
    .order("created_at", { ascending: false });

  if (messages.error) {
    logger.error("updateChatTitle", `Error getting message: ${messages.error?.message}`);

    return {
      data: null,
      error: new Error(messages.error?.message ?? "Unknown error"),
    };
  }

  const uiMessages = messages.data
    .map((message) =>
      convertMessageToUIMessage(decryptMessageForThread(message as Message, ownerId))
    )
    .filter((message): message is UIMessage => message !== null);

  if (uiMessages.length === 0) {
    logger.error("updateChatTitle", `No messages found for chat: ${chatId}`);

    return {
      data: null,
      error: new Error("No messages found for chat"),
    };
  }

  // Chronological order (oldest first) for coherent summary/title
  const chronologicalMessages = [...uiMessages].reverse();
  const messagesForTitle = trimMessagesToTokenBudget(
    chronologicalMessages,
    CHAT_TITLE_MAX_INPUT_TOKENS
  );

  if (messagesForTitle.length < chronologicalMessages.length) {
    logger.log(
      "generateChatTitle",
      `Trimmed ${chronologicalMessages.length} messages to ${messagesForTitle.length} (${CHAT_TITLE_MAX_INPUT_TOKENS} token cap)`
    );
  }

  // Gemini models require well-formed tool call parts (with thought_signature).
  // For title generation we don't need tool traces, so strip any non-text parts
  // (tool calls, tool results, etc.) before sending messages to the model.
  const messagesForTitleClean = messagesForTitle.map((message) => ({
    ...message,
    parts: (message.parts ?? []).filter((part) => part.type === "text" && "text" in part),
  }));

  let conversationSummary: string;

  try {
    const summaryStart = performance.now();
    const summaryResult = await generateText({
      model: MODEL_SELECTION.summarizer,
      system: `
    You are a helpful assistant that generates a summary of a chat.
    The chat messages will be provided to you.
    Generate a summary of the chat of up to 400 words.
    `,
      messages: convertToModelMessages(messagesForTitleClean),
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const summaryDuration = performance.now() - summaryStart;

    recordLlmCall({
      model: MODEL_SELECTION.summarizer as string,
      usage: summaryResult.usage,
      durationMs: summaryDuration,
      metadata: { operation: "chatTitle-summary", contextId: chatId },
    });
    conversationSummary = summaryResult.text ?? "";
  } catch (err) {
    logger.error(
      "generateChatTitle",
      `Error generating conversation summary: ${err instanceof Error ? err.message : String(err)}`
    );

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to generate summary"),
    };
  }

  const shortTitleResult = await generateShortTitleFromSummary(conversationSummary, {
    contextId: chatId,
    operation: "chatTitle-title",
    subject: "chat",
  });

  if (shortTitleResult.error) {
    return {
      data: null,
      error: shortTitleResult.error,
    };
  }

  const titleIdea = shortTitleResult.data ?? "";
  const finalTitle = titleIdea.length > 0 ? titleIdea : "Chat";

  const res = await updateChatTitle(chatId, finalTitle);

  if (res.error) {
    logger.error("updateChatTitle", `Error updating chat title: ${res.error.message}`);

    return {
      data: null,
      error: new Error(res.error.message),
    };
  }

  return {
    data: finalTitle,
    error: null,
  };
}

export async function summarizeChat(chatId: string): Promise<Result<string, string>> {
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
    logger.warn("summarizeChat", `Chat ${chatId} has more than 75 messages, truncating`);
    messages = messages.slice(-75);
  }

  // Convert tool-invocation parts to text so Gemini 3 does not require thought_signature.
  // Preserves tool semantics (name, args, result) for the summarizer.
  const messagesForSummary = convertToolCallsToTextForSummarizer(messages);
  const modelMessages = convertToModelMessages(messagesForSummary);

  // logger.log(
  //   "summarizeChat",
  //   `Messages to be summarized\n${JSON.stringify(modelMessages)}`
  // );

  logger.log("summarizeChat", `Summarizing chat ${chatId} with ${modelMessages.length} messages`);

  const summarizeStart = performance.now();
  const summarizeResult = await generateText({
    model: MODEL_SELECTION.summarizer,
    system: SummarizerSystemPrompt,
    temperature: 0.2,
    messages: modelMessages,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });
  const summarizeDuration = performance.now() - summarizeStart;

  recordLlmCall({
    model: MODEL_SELECTION.summarizer as string,
    usage: summarizeResult.usage,
    durationMs: summarizeDuration,
    metadata: { operation: "chat-summary", contextId: chatId },
  });

  let conversationSummary = summarizeResult.text ?? "";

  summaryGenerationCount++;

  logger.log(
    "summarizeChat",
    `Generated initial conversation summary for chat ${chatId}\n`
    //`Conversation Summary (v${summaryGenerationCount}): ${conversationSummary}`,
  );

  const validatedSummaryRes = await validateSummary(conversationSummary, modelMessages);

  if (validatedSummaryRes.error || !validatedSummaryRes.data) {
    return {
      data: null,
      error: validatedSummaryRes.error,
    };
  }

  conversationSummary = validatedSummaryRes.data;

  if (conversationSummary === null) {
    logger.error("summarizeChat", "Conversation summary could not be generated.");

    return {
      data: null,
      error: "Conversation summary could not be generated.",
    };
  }

  const { error: sbError } = await updateConversationSummary(chatId, conversationSummary);

  if (sbError) {
    logger.error("summarizeChat", "Conversation summary could not be updated.", sbError);

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

export async function summarizeNewChat(chatId: string): Promise<Result<string, string>> {
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

  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      data: null,
      error: threadOwnerContext.error?.message ?? "Thread owner not found",
    };
  }

  const ownerId = threadOwnerContext.data.ownerId;

  // logger.log("summarizeChatNEW", `Generated summary: ${summary}`);
  const { error: sbError } = await sb.from("thread_summaries").insert({
    thread_id: chatId,
    summary_text: encryptThreadSummary(summary, ownerId, chatId),
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

export async function updateChatSummary(chatId: string): Promise<Result<string, string>> {
  logger.log("updateChatSummary", `Updating chat summary for chat ${chatId}`);
  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      data: null,
      error: threadOwnerContext.error?.message ?? "Thread owner not found",
    };
  }

  const ownerId = threadOwnerContext.data.ownerId;

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
    logger.error("updateChatSummary", `Error getting thread summary: ${error.message}`);

    return {
      data: null,
      error: error.message,
    };
  } else if (!threadSummaryData) {
    // If no thread summary data, generate a new one
    return await summarizeNewChat(chatId);
  }

  const threadSummary = ThreadSummarySchema.parse({
    ...threadSummaryData,
    summary_text: decryptThreadSummary(threadSummaryData.summary_text, ownerId, chatId),
  });

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
    `Messages since latest summary: ${messagesRes.data?.length ?? 0} messages`
  );

  if (messagesRes.data?.length === 0) {
    logger.log("updateChatSummary", `No messages found since latest message`);

    return {
      data: null,
      error: "No messages found since latest message",
    };
  }

  if (messagesRes.error || !messagesRes.data) {
    logger.error("updateChatSummary", `Error getting messages: ${messagesRes.error.message}`);

    return {
      data: null,
      error: messagesRes.error.message ?? "No messages found",
    };
  }

  /**
   * Only generate new chat summary every 6 messages
   */

  if (messagesRes.data?.length <= 6) {
    logger.log(
      "updateChatSummary",
      `Not enough messages to generate new chat summary. Only generate every 6 new messages. ${messagesRes.data?.length} messages since last summary`
    );

    return {
      data: null,
      error: "Not enough new messages to generate new chat summary.",
    };
  }

  const uiMessages = messagesRes.data
    .map((message) => convertMessageToUIMessage(decryptMessageForThread(message, ownerId)))
    .filter((message) => message !== null);

  if (uiMessages.length !== messagesRes.data.length) {
    logger.error("updateChatSummary", "A message was not converted to UIMessage");
  }

  // Convert tool-invocation parts to text so Gemini 3 does not require thought_signature.
  const messagesForSummary = convertToolCallsToTextForSummarizer(uiMessages as UIMessage[]);
  const modelMessages = convertToModelMessages(messagesForSummary);

  const { text: updatedSummary } = await generateText({
    model: MODEL_SELECTION.updater,
    system: UpdateSummarizerSystemPrompt.replace(
      "{{conversationSummary}}",
      threadSummary.summary_text
    ),
    temperature: 0.3,
    messages: modelMessages,
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
  });

  // logger.log("updateChatSummary", `Updated summary: ${updatedSummary}`);

  const validatedSummaryRes = await validateSummary(updatedSummary, modelMessages);

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
      summary_text: encryptThreadSummary(
        validatedSummaryRes.data,
        threadOwnerContext.data.ownerId,
        chatId
      ),
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
  forceGeneration?: boolean
): Promise<Result<string, string>> => {
  let validSummary: ValidSummary | null = null;

  // Generate conversation summary and validate result
  for (let i = 1; i <= 3; i++) {
    const validatorStart = performance.now();
    const validatorRes = await generateObject({
      model: MODEL_SELECTION.validator,
      system: ValidatorSystemPrompt.replace(
        "{{currentPersistedConversationSummary}}",
        currentPersistedConversationSummary ?? "null"
      ).replace("{{conversationSummary}}", conversationSummary),
      temperature: 0.1,
      messages: messages,
      schema: ValidSummarySchema,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const validatorDuration = performance.now() - validatorStart;

    recordLlmCall({
      model: MODEL_SELECTION.validator as string,
      usage: validatorRes.usage,
      durationMs: validatorDuration,
      metadata: { operation: "summary-validator" },
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
      `Validator has rejected summary v${i}\nWith response: ${JSON.stringify(validSummary)}`
    );

    const reviserStart = performance.now();
    const reviserResult = await generateText({
      model: MODEL_SELECTION.reviser,
      system: ReviserSystemPrompt.replace("{{conversationSummary}}", conversationSummary)
        .replace(
          "{{currentPersistedConversationSummary}}",
          currentPersistedConversationSummary ?? "null"
        )
        .replace("{{reason}}", validSummary.reason),
      temperature: 0.2,
      messages: messages,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const reviserDuration = performance.now() - reviserStart;

    recordLlmCall({
      model: MODEL_SELECTION.reviser as string,
      usage: reviserResult.usage,
      durationMs: reviserDuration,
      metadata: { operation: "summary-reviser" },
    });

    let { text: updatedConversationSummary } = reviserResult;

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

/**
 * Count tokens in text using OpenAI's tiktoken tokenizer.
 * Uses the cl100k_base encoding which is compatible with GPT-4 and GPT-3.5-turbo models.
 * This is a close approximation for newer models like GPT-4o and GPT-5.
 * @param text - The text to count tokens for
 * @returns The number of tokens, or null if encoding fails
 */
export const estimateTokenCount = async (text: string): Promise<number | null> => {
  // TODO: CLEAN UP THIS FUNCTION TO ENSURE IT'S ACCURACY
  try {
    // Use gpt-5 encoding (cl100k_base) which is compatible with most modern OpenAI models
    const encoding = encodingForModel("gpt-5");
    const tokens = encoding.encode(text);

    return tokens.length;
  } catch (error) {
    logger.error("estimateTokenCount", `Error counting tokens: ${error}`);

    return null;
  }
};
