import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { generateShortTitleFromSummary } from "@/lib/llm/short-title-from-summary";
import { TITLE_PIPELINE_SUMMARIZER_MODEL } from "@/lib/llm/title-models";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import type { Result } from "@/types";

const logger = createLogger("lib/llm/strata-title.ts");

/** Above this length, run the summarizer before the short-title model (mirrors chat title flow). */
const STRATA_TITLE_SOURCE_CHAR_THRESHOLD = 8_000;

const STRATA_DOCUMENT_SUMMARY_SYSTEM = `
You are Organic LLM's summarizer.
Summarize the document excerpt into ONE clear paragraph (2–4 sentences, under 600 tokens).
Capture the main topic, intent, and any distinctive proper nouns the user cares about.
Be concise, neutral, and free of lists or markdown. Output plain text only.
`;

function buildTitleSourceText(rawSanitized: string, refinedText: string): string {
  const rawExcerpt = rawSanitized.trim().slice(0, 4_000);
  const refined = refinedText.trim();
  if (!refined) {
    return rawExcerpt;
  }
  if (!rawExcerpt) {
    return `Refined:\n${refined}`;
  }
  return `Raw excerpt:\n${rawExcerpt}\n\nRefined:\n${refined}`;
}

function fallbackTitle(
  refinedGeneratedTitle: string | null | undefined,
  rawSanitized: string
): string {
  const fromJson = refinedGeneratedTitle?.replace(/\s+/g, " ").trim() ?? "";
  if (fromJson.length > 0) {
    return fromJson.slice(0, 255);
  }
  const firstLine = rawSanitized.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  if (firstLine.length > 0) {
    return firstLine.slice(0, 255);
  }
  return "Strata";
}

/**
 * Produces a display title for a Strata page using the same short-title model as chat,
 * optionally preceded by a summarizer pass when source text is long.
 */
export async function generateStrataPageTitleFromSections(options: {
  pageId: string;
  rawText: string;
  refinedText: string;
  refinedGeneratedTitle?: string | null;
}): Promise<Result<string>> {
  const rawSanitized = sanitizeRawUserInput(options.rawText);
  const source = buildTitleSourceText(rawSanitized, options.refinedText);

  if (source.trim().length === 0) {
    return {
      data: null,
      error: new Error("No content available to generate a Strata title"),
    };
  }

  let summaryForTitle = source;

  if (source.length > STRATA_TITLE_SOURCE_CHAR_THRESHOLD) {
    try {
      const summaryStart = performance.now();
      const summaryResult = await generateText({
        model: TITLE_PIPELINE_SUMMARIZER_MODEL,
        system: STRATA_DOCUMENT_SUMMARY_SYSTEM,
        prompt: source,
        maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
      });
      const summaryDuration = performance.now() - summaryStart;

      recordLlmCall({
        model: TITLE_PIPELINE_SUMMARIZER_MODEL as string,
        usage: summaryResult.usage,
        durationMs: summaryDuration,
        metadata: { operation: "strataTitle-summary", contextId: options.pageId },
      });

      summaryForTitle = (summaryResult.text ?? "").trim();
      if (summaryForTitle.length === 0) {
        summaryForTitle = source.slice(0, STRATA_TITLE_SOURCE_CHAR_THRESHOLD);
      }
    } catch (err) {
      logger.error(
        "generateStrataPageTitleFromSections",
        `Summarizer failed: ${err instanceof Error ? err.message : String(err)}`
      );
      summaryForTitle = source.slice(0, STRATA_TITLE_SOURCE_CHAR_THRESHOLD);
    }
  }

  const shortTitleResult = await generateShortTitleFromSummary(summaryForTitle, {
    contextId: options.pageId,
    operation: "strataTitle-title",
    subject: "strata",
  });

  if (shortTitleResult.error) {
    return {
      data: fallbackTitle(options.refinedGeneratedTitle, rawSanitized),
      error: null,
    };
  }

  const idea = (shortTitleResult.data ?? "").trim();
  if (idea.length > 0) {
    return { data: idea, error: null };
  }

  return {
    data: fallbackTitle(options.refinedGeneratedTitle, rawSanitized),
    error: null,
  };
}
