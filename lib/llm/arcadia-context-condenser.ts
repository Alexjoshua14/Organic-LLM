"use server";

import { convertToModelMessages, generateText, type UIMessage } from "ai";

import { getThreadOwnerContext } from "@/data/supabase/chat";
import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import { convertToolCallsToTextForSummarizer } from "@/lib/llm/summarizer-message-format";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { estimateTokenCount } from "@/lib/llm/chat-helpers";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";
import { supabaseServer } from "@/lib/supabase/server";
import type { Result } from "@/types";

const logger = createLogger("lib/llm/arcadia-context-condenser.ts");

const InitialCondenserSystemPrompt = `
You are Organic LLM's conversation condenser.
Summarize the provided messages into ONE clear paragraph (2–4 sentences, under 600 tokens).
Include: main objectives/tasks, important decisions or open questions, and the current focus/next step.
Be concise, neutral, and output plain text only.
`;

const UpdateCondenserSystemPrompt = `
You are Organic LLM's conversation condenser.
Update the previous summary by integrating the NEW messages provided.
Produce ONE clear paragraph (2–4 sentences, under 600 tokens) that preserves key details from the prior summary while adding new information.
Include: objectives/tasks, decisions or questions, and current focus/next step.
Be concise, neutral, and output plain text only.

Previous summary:
{{conversationSummary}}
`;

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

export type CondenseArcadiaContextParams = {
  chatId: string;
  modelId: string;
  messagesToCondense: UIMessage[];
  existingSummary?: string;
};

/**
 * Fold older Arcadia messages into the encrypted thread summary using the active chat model
 * (same model as the turn) to maximize provider prompt-cache reuse.
 */
export async function condenseArcadiaContext(
  params: CondenseArcadiaContextParams
): Promise<Result<string, string>> {
  const { chatId, modelId, messagesToCondense, existingSummary } = params;

  if (messagesToCondense.length === 0) {
    return { data: existingSummary ?? "", error: null };
  }

  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return {
      data: null,
      error: threadOwnerContext.error?.message ?? "Thread owner not found",
    };
  }

  const ownerId = threadOwnerContext.data.ownerId;
  const messagesForSummary = convertToolCallsToTextForSummarizer(messagesToCondense);
  const modelMessages = convertToModelMessages(messagesForSummary);

  const systemPrompt =
    existingSummary?.trim().length
      ? UpdateCondenserSystemPrompt.replace("{{conversationSummary}}", existingSummary.trim())
      : InitialCondenserSystemPrompt;

  const condenseStart = performance.now();

  let summaryText: string;

  try {
    const result = await generateText({
      model: modelId,
      system: systemPrompt,
      temperature: 0.2,
      messages: modelMessages,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });

    recordLlmCall({
      model: modelId,
      usage: result.usage,
      durationMs: performance.now() - condenseStart,
      metadata: { operation: "arcadia-context-condense", contextId: chatId },
    });

    summaryText = result.text?.trim() ?? "";
  } catch (error) {
    logger.error(
      "condenseArcadiaContext",
      `Condensation failed: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      data: null,
      error: error instanceof Error ? error.message : "Condensation failed",
    };
  }

  if (!summaryText) {
    return {
      data: null,
      error: "Condensation produced an empty summary",
    };
  }

  const summaryTokens = (await estimateTokenCount(summaryText)) ?? 600;
  const lastCondensedMessage = messagesToCondense[messagesToCondense.length - 1];

  if (!lastCondensedMessage?.id) {
    return {
      data: null,
      error: "Missing condensed message id",
    };
  }

  const sb = await supabaseServer();
  const { data: existingRow, error: existingError } = await sb
    .from("thread_summaries")
    .select("id")
    .eq("thread_id", chatId)
    .maybeSingle();

  if (existingError) {
    return {
      data: null,
      error: existingError.message,
    };
  }

  const encryptedSummary = encryptThreadSummary(summaryText, ownerId, chatId);
  const lastSummarizedAt = new Date().toISOString();

  if (existingRow) {
    const { error: updateError } = await sb
      .from("thread_summaries")
      .update({
        summary_text: encryptedSummary,
        summary_tokens: summaryTokens,
        last_summarized_message_id: lastCondensedMessage.id,
        last_summarized_at: lastSummarizedAt,
      })
      .eq("thread_id", chatId);

    if (updateError) {
      return { data: null, error: updateError.message };
    }
  } else {
    const { error: insertError } = await sb.from("thread_summaries").insert({
      thread_id: chatId,
      summary_text: encryptedSummary,
      summary_tokens: summaryTokens,
      last_summarized_message_id: lastCondensedMessage.id,
      last_summarized_at: lastSummarizedAt,
    });

    if (insertError) {
      return { data: null, error: insertError.message };
    }
  }

  await sb
    .from("threads")
    .update({ conversation_summary: summaryText })
    .eq("id", chatId);

  logger.log("condenseArcadiaContext", "Arcadia context condensed", {
    chatId,
    modelId,
    condensedMessageCount: messagesToCondense.length,
    summaryTokens,
  });

  return { data: summaryText, error: null };
}

export async function getLastSummarizedMessageId(chatId: string): Promise<string | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("thread_summaries")
    .select("last_summarized_message_id")
    .eq("thread_id", chatId)
    .maybeSingle();

  if (error || !data?.last_summarized_message_id) {
    return null;
  }

  return data.last_summarized_message_id;
}

/**
 * Drops messages already folded into the persisted summary (by last_summarized_message_id).
 */
export async function filterCondenseCandidates(params: {
  chatId: string;
  allMessages: UIMessage[];
  messagesToCondense: UIMessage[];
}): Promise<UIMessage[]> {
  const { chatId, allMessages, messagesToCondense } = params;
  const lastSummarizedMessageId = await getLastSummarizedMessageId(chatId);

  if (!lastSummarizedMessageId) {
    return messagesToCondense;
  }

  const markerIndex = allMessages.findIndex((message) => message.id === lastSummarizedMessageId);

  if (markerIndex === -1) {
    return messagesToCondense;
  }

  return messagesToCondense.filter((message) => {
    const messageIndex = allMessages.findIndex((candidate) => candidate.id === message.id);

    return messageIndex > markerIndex;
  });
}

export async function loadExistingThreadSummary(chatId: string): Promise<string> {
  const sb = await supabaseServer();
  const threadOwnerContext = await getThreadOwnerContext(chatId);

  if (threadOwnerContext.error || !threadOwnerContext.data) {
    return "";
  }

  const ownerId = threadOwnerContext.data.ownerId;
  const { data, error } = await sb
    .from("thread_summaries")
    .select("summary_text")
    .eq("thread_id", chatId)
    .maybeSingle();

  if (error || !data?.summary_text) {
    return "";
  }

  return decryptThreadSummary(data.summary_text, ownerId, chatId);
}
