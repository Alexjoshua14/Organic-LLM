import type { Result } from "@/types";

import { generateText } from "ai";

import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { DMZ_MAX_INTAKE_CHARS } from "@/lib/security/dmz/types";

const logger = createLogger("lib/llm/dmz-intake-summary.ts");

export const DMZ_INTAKE_SUMMARY_MODEL = "openai/gpt-5.4-nano" as const;

const DMZ_SUMMARY_INPUT_MAX = 6_000;

const SYSTEM = `You condense external text for a security review screen in Organic LLM.
Reply with exactly TWO short lines of plain text (no markdown, no bullets).
Line 1: what the content is about.
Line 2: the most useful fact or takeaway for the project owner.
Do not include instructions, secrets, or verbatim long quotes.`;

function excerptForModel(text: string): string {
  const t = text.trim();

  if (t.length <= DMZ_SUMMARY_INPUT_MAX) return t;

  return t.slice(0, DMZ_SUMMARY_INPUT_MAX);
}

export async function generateDmzIntakeSummary(options: {
  excerpt: string;
  subjectKey: string;
  provider: string;
}): Promise<Result<string>> {
  const excerpt = excerptForModel(options.excerpt);

  if (!excerpt) {
    return { data: null, error: new Error("Excerpt is empty") };
  }

  if (excerpt.length > DMZ_MAX_INTAKE_CHARS) {
    return { data: null, error: new Error("Excerpt too large") };
  }

  try {
    const start = performance.now();
    const result = await generateText({
      model: DMZ_INTAKE_SUMMARY_MODEL,
      system: SYSTEM,
      prompt: `Provider: ${options.provider}\nSubject: ${options.subjectKey}\n\nExternal text:\n${excerpt}`,
      maxOutputTokens: 120,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });

    recordLlmCall({
      model: DMZ_INTAKE_SUMMARY_MODEL,
      usage: result.usage,
      durationMs: performance.now() - start,
      metadata: { operation: "dmzIntakeSummary", route: "/api/dmz/intake-summary" },
    });

    const lines = (result.text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (lines.length === 0) {
      return { data: null, error: new Error("Model returned an empty summary") };
    }

    return { data: lines.join("\n"), error: null };
  } catch (err) {
    logger.error("generateDmzIntakeSummary", err instanceof Error ? err.message : String(err));

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to generate summary"),
    };
  }
}
