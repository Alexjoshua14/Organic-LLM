import type { Result } from "@/types";

import { generateText } from "ai";

import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";

const logger = createLogger("lib/llm/strata-clipboard-source-title.ts");

const STRATA_CLIPBOARD_TITLE_MODEL = "openai/gpt-5.4-nano" as const;

/** Only this prefix of the pasted excerpt is sent to the model (cost + context cap). */
const STRATA_CLIPBOARD_TITLE_LLM_INPUT_MAX = 8_000;

const CLIPBOARD_SOURCE_TITLE_SYSTEM = `You name a short text snippet the user is about to save as a research/source note.
Reply with ONE title only: plain text, no quotes, no markdown.
Aim for 6–48 characters; hard max 80 characters.
Be specific (topics, names, dates) when the text allows; otherwise a neutral label.`;

function excerptForModel(excerpt: string): string {
  const t = excerpt.trim();

  if (t.length <= STRATA_CLIPBOARD_TITLE_LLM_INPUT_MAX) return t;

  return t.slice(0, STRATA_CLIPBOARD_TITLE_LLM_INPUT_MAX);
}

/**
 * Short title for pasted source text using GPT‑5 Nano with **forced** AI Gateway ZDR.
 */
export async function generateStrataClipboardSourceTitle(options: {
  excerpt: string;
  contextId: string;
}): Promise<Result<string>> {
  const prompt = excerptForModel(options.excerpt);

  if (prompt.length === 0) {
    return { data: null, error: new Error("Excerpt is empty") };
  }

  try {
    const start = performance.now();
    const result = await generateText({
      model: STRATA_CLIPBOARD_TITLE_MODEL,
      system: CLIPBOARD_SOURCE_TITLE_SYSTEM,
      prompt,
      maxOutputTokens: 96,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });
    const durationMs = performance.now() - start;

    recordLlmCall({
      model: STRATA_CLIPBOARD_TITLE_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "strataClipboardSourceTitle", contextId: options.contextId },
    });

    const title = (result.text ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .split("\n")[0]
      ?.trim()
      .slice(0, 512);

    if (!title) {
      return { data: null, error: new Error("Model returned an empty title") };
    }

    return { data: title, error: null };
  } catch (err) {
    logger.error(
      "generateStrataClipboardSourceTitle",
      err instanceof Error ? err.message : String(err)
    );

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to generate title"),
    };
  }
}
