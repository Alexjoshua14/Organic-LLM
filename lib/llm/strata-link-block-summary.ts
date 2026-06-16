import type { Result } from "@/types";

import { generateText } from "ai";

import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { getModelCost } from "@/lib/rate-limit/llm-cost";

const logger = createLogger("lib/llm/strata-link-block-summary.ts");

const STRATA_LINK_SUMMARY_MODEL = "openai/gpt-5.4-nano" as const;
const INPUT_CHAR_LIMIT = 8_000;

const SYSTEM_PROMPT = `You summarize fetched webpage text for a research notepad block.
Return strict JSON only with:
{
  "title": string, // <= 90 chars
  "summary": string // 2-4 concise sentences, no markdown bullets
}
Focus on key claims and practical insights with neutral tone.`;

type LinkSummaryPayload = {
  title: string;
  summary: string;
  estimatedCostUsd: number;
};

function trimInput(input: string): string {
  const text = input.trim();

  return text.length <= INPUT_CHAR_LIMIT ? text : text.slice(0, INPUT_CHAR_LIMIT);
}

function estimateUsd(
  usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      }
    | undefined
): number {
  const cfg = getModelCost(STRATA_LINK_SUMMARY_MODEL);
  const inputTokens = usage?.inputTokens ?? usage?.promptTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? usage?.completionTokens ?? 0;

  return (
    (inputTokens / 1_000_000) * cfg.inputPerMillion +
    (outputTokens / 1_000_000) * cfg.outputPerMillion
  );
}

export async function generateStrataLinkSummary(args: {
  url: string;
  titleHint: string;
  extractedText: string;
  contextId: string;
}): Promise<Result<LinkSummaryPayload>> {
  const body = trimInput(args.extractedText);

  if (!body) return { data: null, error: new Error("No extracted content to summarize") };

  try {
    const started = performance.now();
    const prompt = [`URL: ${args.url}`, `Title hint: ${args.titleHint}`, "", body].join("\n");
    const result = await generateText({
      model: STRATA_LINK_SUMMARY_MODEL,
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 220,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });
    const durationMs = performance.now() - started;

    recordLlmCall({
      model: STRATA_LINK_SUMMARY_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "strataLinkBlockSummary", contextId: args.contextId },
    });

    const parsed = JSON.parse(result.text ?? "{}") as { title?: unknown; summary?: unknown };
    const titleRaw =
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title.trim()
        : args.titleHint || args.url;
    const summaryRaw = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

    if (!summaryRaw) {
      return { data: null, error: new Error("Model did not return a summary") };
    }

    return {
      data: {
        title: titleRaw.slice(0, 512),
        summary: summaryRaw.slice(0, 8_000),
        estimatedCostUsd: estimateUsd(result.usage),
      },
      error: null,
    };
  } catch (error) {
    logger.error(
      "generateStrataLinkSummary",
      error instanceof Error ? error.message : String(error)
    );

    return {
      data: null,
      error: new Error(error instanceof Error ? error.message : "Failed to summarize link"),
    };
  }
}
