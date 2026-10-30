import "server-only";

import type { Result } from "@/types";

import { generateText } from "ai";

import { CHAT_TITLE_SYSTEM } from "@/lib/llm/chat-title-system";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { recordLlmCall } from "@/lib/llm/metrics";
import { TITLE_PIPELINE_SHORT_TITLE_MODEL } from "@/lib/llm/title-models";

export { CHAT_TITLE_SYSTEM } from "@/lib/llm/chat-title-system";

const logger = createLogger("lib/llm/short-title-from-summary.ts");

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
    ownerId: string;
    operation: string;
    subject: "chat" | "strata";
  }
): Promise<Result<string>> {
  const trimmedSummary = summary.trim();

  if (trimmedSummary.length === 0) {
    return { data: "", error: null };
  }

  const system = options.subject === "chat" ? CHAT_TITLE_SYSTEM : STRATA_TITLE_SYSTEM;

  try {
    const titleStart = performance.now();
    const titleResult = await generateText({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL,
      ...createLlmBudgetHooks({
        ownerId: options.ownerId,
        modelId: TITLE_PIPELINE_SHORT_TITLE_MODEL as string,
        operation: options.operation,
      }),
      instructions: system,
      prompt: trimmedSummary,
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
