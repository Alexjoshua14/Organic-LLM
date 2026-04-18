import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import type { Result } from "@/types";
import { TITLE_PIPELINE_SHORT_TITLE_MODEL } from "@/lib/llm/title-models";

const logger = createLogger("lib/llm/short-title-from-summary.ts");

const CHAT_TITLE_SYSTEM = `
    You are a helpful assistant that generates a title for a chat.
    Generate a title for the chat based on the conversation summary.
    The title should be no more than 20 characters.
    But can be up to 30 characters if truly necessary.
    Return only the title, no other text. No quotes.
    `;

const STRATA_TITLE_SYSTEM = `
    You are a helpful assistant that generates a short title for a Strata document page.
    Generate a title based on the document summary below.
    The title should be no more than 20 characters.
    But can be up to 30 characters if truly necessary.
    Return only the title, no other text. No quotes.
    `;

/**
 * Second step of the chat title pipeline: turn a summary (or short source text) into a display title.
 * Used by chat (`generateChatTitle`) and Strata document title generation.
 */
export async function generateShortTitleFromSummary(
  summary: string,
  options: {
    contextId: string;
    operation: string;
    subject: "chat" | "strata";
  }
): Promise<Result<string>> {
  const system = options.subject === "chat" ? CHAT_TITLE_SYSTEM : STRATA_TITLE_SYSTEM;

  try {
    const titleStart = performance.now();
    const titleResult = await generateText({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL,
      system,
      prompt: summary,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const titleDuration = performance.now() - titleStart;

    recordLlmCall({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL as string,
      usage: titleResult.usage,
      durationMs: titleDuration,
      metadata: { operation: options.operation, contextId: options.contextId },
    });

    const titleIdea = (titleResult.text ?? "").trim().replace(/^["']|["']$/g, "");
    return {
      data: titleIdea.slice(0, 255),
      error: null,
    };
  } catch (err) {
    logger.error(
      "generateShortTitleFromSummary",
      `Error generating title: ${err instanceof Error ? err.message : String(err)}`
    );

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to generate title"),
    };
  }
}
