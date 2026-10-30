import "server-only";

import type { Result } from "@/types";

import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import {
  KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
  parseKnowledgeCapsuleTitle,
  type KnowledgeCapsuleParseResult,
} from "@/lib/llm/knowledge-capsule-title-grammar";
import { createLogger } from "@/lib/logger";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { recordLlmCall } from "@/lib/llm/metrics";
import { TITLE_PIPELINE_SHORT_TITLE_MODEL } from "@/lib/llm/title-models";

export {
  joinSlots,
  KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS,
  KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM,
  KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS,
  KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
  KnowledgeCapsuleSlotsSchema,
  normalizeKnowledgeCapsuleSlots,
  parseFreeformCapsuleLine,
  parseKnowledgeCapsuleTitle,
  splitWords,
  type KnowledgeCapsuleParseResult,
  type KnowledgeCapsuleParseStatus,
  type KnowledgeCapsuleSlots,
} from "@/lib/llm/knowledge-capsule-title-grammar";

const logger = createLogger("lib/llm/knowledge-capsule-title.ts");

/**
 * Second step of the knowledge-capsule title pipeline: summary → grammar-validated title.
 */
export async function generateKnowledgeCapsuleTitleFromSummary(
  summary: string,
  options: {
    contextId: string;
    ownerId: string;
    operation: string;
  }
): Promise<Result<KnowledgeCapsuleParseResult>> {
  const trimmedSummary = summary.trim();

  if (trimmedSummary.length === 0) {
    return {
      data: {
        status: "invalid",
        slots: { action: "", subject: "", additional: "" },
        title: "",
        wordCount: 0,
        notes: ["empty summary"],
        rawText: "",
      },
      error: null,
    };
  }

  try {
    const titleStart = performance.now();
    const titleResult = await generateText({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL,
      ...createLlmBudgetHooks({
        ownerId: options.ownerId,
        modelId: TITLE_PIPELINE_SHORT_TITLE_MODEL as string,
        operation: options.operation,
      }),
      instructions: KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
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

    const rawText = (titleResult.text ?? "").trim();
    const parsed = parseKnowledgeCapsuleTitle(rawText);

    return { data: parsed, error: null };
  } catch (err) {
    logger.error(
      "generateKnowledgeCapsuleTitleFromSummary",
      `Error generating capsule title: ${err instanceof Error ? err.message : String(err)}`
    );

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to generate capsule title"),
    };
  }
}
