import { z } from "zod";
import { generateObject } from "ai";

import { createLogger } from "@/lib/logger";

export const MAX_WINES = 20;

const logger = createLogger("lib/llm/sommelier/parser.ts");

const PARSER_INPUT_MAX_CHARS = 2000;

const WineCountSchema = z.object({
  count: z.number().int().min(0).max(MAX_WINES),
});

const PARSER_SYSTEM =
  "You only output how many distinct wines or bottles the user is describing. Output a single integer in the required JSON.";

/**
 * Lightweight LLM call to determine how many wines the user described.
 * Truncates input to keep tokens minimal. Returns 1 on failure or 0; clamps to [1, MAX_WINES].
 */
export async function parseWineCount(userText: string): Promise<number> {
  const truncated =
    userText.length > PARSER_INPUT_MAX_CHARS
      ? userText.slice(0, PARSER_INPUT_MAX_CHARS) + "..."
      : userText;

  logger.debug("parseWineCount", "input", {
    originalLength: userText.length,
    truncatedLength: truncated.length,
    preview: truncated.slice(0, 120) + (truncated.length > 120 ? "…" : ""),
  });

  try {
    const { object } = await generateObject({
      model: "openai/gpt-5-nano",
      system: PARSER_SYSTEM,
      prompt: truncated,
      schema: WineCountSchema,
      maxOutputTokens: 10,
    });
    const count = (object as { count: number }).count;
    const clamped = typeof count !== "number" || count < 1 ? 1 : Math.min(count, MAX_WINES);

    logger.debug("parseWineCount", "output", { rawCount: count, clamped });

    return clamped;
  } catch (err) {
    logger.debug("parseWineCount", "error, returning 1", { err });

    return 1;
  }
}
