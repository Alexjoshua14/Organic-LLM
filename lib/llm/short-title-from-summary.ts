import type { Result } from "@/types";

import { generateText } from "ai";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { TITLE_PIPELINE_SHORT_TITLE_MODEL } from "@/lib/llm/title-models";

const logger = createLogger("lib/llm/short-title-from-summary.ts");

const CHAT_TITLE_SYSTEM = `
You name Organic LLM chat threads for the sidebar. You receive a short conversation summary (not raw messages).

## Output
- Return exactly one line: the title only. No quotes, no punctuation at the end, no labels like "Title:".
- Prefer ~20–35 characters. Go slightly longer only when a specific name, place, or date makes the thread findable.
- Match the user's language when the summary is clearly in a non-English language.

## Style
- Use a scannable noun phrase or short task + object: what someone would click in history days later.
- Prefer concrete nouns (projects, technologies, people, places) over vague words like "Question", "Help", "Chat", "Discussion".
- Drop filler: no "Can you", "I want to", "How do I" — start at the substance.
- Title case or sentence case is fine; be consistent within one title.

## Low-signal and ephemeral threads
When the summary says there is no real topic yet (pure greeting, thanks, acknowledgments, idle small talk):
- Use "New chat" for greeting-only / no substantive content.
- Use "Quick chat" or "Brief exchange" if there was light back-and-forth but nothing to revisit; pick the single best fit.

When the summary is a one-off lookup (weather, time zone, quick fact) and details exist in the summary:
- Include topic + specificity when given (e.g. place, date): e.g. "SF weather · May 3" or "Dubai weather — May 3" — keep compact; use · or — sparingly.
- If the summary is too thin for a specific label, use a generic ephemeral label: "Weather lookup", "Time check", or "Quick fact".

## Examples (summary → title)
- "User asked to design a Postgres schema for orders and line items; assistant proposed normalized tables with foreign keys." → Postgres order schema
- "Debugging Next.js hydration mismatch on the landing page after upgrading React." → Next hydration fix
- "User requested a polite decline email for a vendor proposal." → Vendor decline email
- "User and assistant exchanged greetings only; no task discussed." → New chat
- "User asked for today's weather in San Francisco on May 3; assistant gave the forecast." → SF weather · May 3

## Anti-patterns (do not do this)
- "Hello and welcome" / "Thanks for the help" as titles when the real task is elsewhere in the summary.
- "Question about..." / "Chat with assistant" / "Organic LLM session"
`.trim();

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
  const trimmedSummary = summary.trim();

  if (trimmedSummary.length === 0) {
    return { data: "", error: null };
  }

  const system = options.subject === "chat" ? CHAT_TITLE_SYSTEM : STRATA_TITLE_SYSTEM;

  try {
    const titleStart = performance.now();
    const titleResult = await generateText({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL,
      system,
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
