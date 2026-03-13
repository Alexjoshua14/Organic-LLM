import { randomUUID } from "crypto";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import type { WineEntry } from "@/lib/schemas/wine-line-list";
import { WineEntrySchema } from "@/lib/schemas/wine-line-list";

const WINE_FIELDS = `- wine: The wine name and key detail (e.g. "Heya \\"Kanz\\" (Grenache/Syrah)" or "Dar Richi \\"Helem\\" (skin-contact Chardonnay)"). Use the producer/cuvee name and varietal or style from the user's text.
- style: A short style note (e.g. "Light, juicy red — serve slightly chilled", "Textured, savory orange wine"). Summarize from tasting notes, body, and serving advice in the message.
- keyFoodAffinities: Comma-separated food pairings. Use the user's pairing suggestions if given (e.g. "herby, olive-oil-driven dishes, smoky grilled foods, mezze"); otherwise suggest sensible pairings from the style.
Optionally include category (red, white, orange) and attributes (e.g. macerated, dry, textured, crowd pleaser) when you can infer them.`;

const WINE_EXTRACT_SYSTEM_ONE = `You are a wine expert. The user will describe or paste information about a single wine. Your job is to extract exactly one wine and return it in a structured form.

Return exactly one wine in the "wines" array with:
${WINE_FIELDS}`;

const WINE_EXTRACT_SYSTEM_MANY = (
  n: number,
) => `You are a wine expert. The user described ${n} wines. Extract exactly ${n} wines in order: first wine in the message = first in the array, second = second, etc.

For each wine in the "wines" array provide:
${WINE_FIELDS}`;

function buildWineListSchema(expectedCount: number) {
  return z.object({
    wines: z.array(WineEntrySchema).min(expectedCount).max(expectedCount),
  });
}

function buildExtractPrompt(userText: string, expectedCount: number): string {
  if (expectedCount === 1) {
    return `Extract the single wine described below into one structured entry. Return a JSON object with a "wines" array containing exactly one wine.\n\nUser's message:\n${userText}`;
  }
  return `Extract the ${expectedCount} wines described below. Return a JSON object with a "wines" array containing exactly ${expectedCount} wines, in the order they appear.\n\nUser's message:\n${userText}`;
}

/**
 * Extract exactly expectedCount wines from the user's message into structured entries.
 * Order preserved: first wine in message = first in array.
 */
export async function extractWines(
  userText: string,
  expectedCount: number,
): Promise<WineEntry[]> {
  const schema = buildWineListSchema(expectedCount);
  const system =
    expectedCount === 1
      ? WINE_EXTRACT_SYSTEM_ONE
      : WINE_EXTRACT_SYSTEM_MANY(expectedCount);
  const prompt = buildExtractPrompt(userText, expectedCount);

  const maxOutputTokens = Math.min(400 * expectedCount, 2000);

  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-4.6",
    system,
    prompt,
    schema,
    maxOutputTokens,
  });

  const list = object as { wines: WineEntry[] };
  return (list.wines ?? []).map((w, i) => ({
    ...w,
    id: w.id ?? `wine-${i}-${randomUUID().slice(0, 8)}`,
  }));
}
