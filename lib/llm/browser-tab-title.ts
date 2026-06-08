import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { BROWSER_TAB_TITLE_MODEL } from "@/lib/llm/title-models";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { computeCost, type Usage } from "@/lib/rate-limit/llm-cost";

const logger = createLogger("lib/llm/browser-tab-title.ts");

/** Hard ceiling per tab-title call (~$0.005 USD). */
const MAX_COST_USD = 0.005;

const BROWSER_TAB_TITLE_MAX_OUT = 64;
const SOURCE_HINT_MAX = 1_400;

const SYSTEM = `You write a single ultra-short browser tab label (max 36 characters).
Rules: no quotes, no emoji, no trailing punctuation clusters, no product or site name.
Use the language of the source when it is clearly not English.
Reply with one line only: the label text.`;

function usageToDollars(modelId: string, usage: Usage | undefined): number {
  const units = computeCost(modelId, usage ?? {});

  return units / 10_000;
}

function sanitizePrimary(raw: string, fallback: string): string {
  const oneLine = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "");

  if (!oneLine) {
    return fallback;
  }

  return oneLine.slice(0, 48);
}

/**
 * Returns a concise primary segment for document.title (before the " · Site" suffix).
 * Returns null when the model should be skipped (caller uses heuristic).
 */
export async function generateBrowserTabTitlePrimary(options: {
  sourceHint: string;
  fallback: string;
  contextId: string;
}): Promise<string | null> {
  const trimmedHint = options.sourceHint.trim().slice(0, SOURCE_HINT_MAX);

  if (!trimmedHint) {
    return null;
  }

  const prompt = `Fallback if the source is unusable (reply EXACTLY this text, same casing): ${options.fallback}

Source:
${trimmedHint}`;

  try {
    const started = performance.now();
    const result = await generateText({
      model: BROWSER_TAB_TITLE_MODEL,
      system: SYSTEM,
      prompt,
      maxOutputTokens: Math.min(BROWSER_TAB_TITLE_MAX_OUT, GUARDRAIL_MAX_OUTPUT_TOKENS),
    });
    const durationMs = performance.now() - started;

    recordLlmCall({
      model: BROWSER_TAB_TITLE_MODEL as string,
      usage: result.usage,
      durationMs,
      metadata: { operation: "browserTabTitle", contextId: options.contextId },
    });

    const dollars = usageToDollars(BROWSER_TAB_TITLE_MODEL as string, result.usage);

    if (dollars > MAX_COST_USD) {
      logger.warn(
        "generateBrowserTabTitlePrimary",
        `Cost $${dollars.toFixed(6)} exceeded max $${MAX_COST_USD}; using fallback`
      );

      return null;
    }

    return sanitizePrimary(result.text ?? "", options.fallback);
  } catch (err) {
    logger.error(
      "generateBrowserTabTitlePrimary",
      err instanceof Error ? err.message : String(err)
    );

    return null;
  }
}
