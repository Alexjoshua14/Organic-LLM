import type { ErgonRefineLlmTask } from "@/lib/schemas/ergon-refine";
import type { Result } from "@/types";

import { generateObject } from "ai";
import { z } from "zod";

import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import {
  ErgonRefineCategoryHintSchema,
  ErgonRefineLlmTaskSchema,
} from "@/lib/schemas/ergon-refine";

const logger = createLogger("lib/ergon/refine-task-capture-llm.ts");

export const ERGON_REFINE_MODEL = "openai/gpt-5.4-nano" as const;
export const ERGON_REFINE_TIMEOUT_MS = 1_500;

type CategoryHint = z.infer<typeof ErgonRefineCategoryHintSchema>;

const ERGON_REFINE_SYSTEM = `You normalize quick-capture todo titles and optionally extract structured fields.

Rules (strict):
- Return exactly one task object per input line, in the same order.
- title: light cleanup only (sentence case, trim). Do NOT rewrite meaning or add words not implied by the source line.
- category_name: set ONLY when the line explicitly mentions a category name that matches one from the provided list (case-insensitive). Otherwise null.
- priority: set ONLY when the line explicitly signals urgency (urgent, asap, important, etc.). Otherwise null.
- due_date / planned_date: ISO date YYYY-MM-DD ONLY when the line explicitly mentions a date or relative day you can resolve from the anchor datetime. Otherwise null.
- est_minutes: set ONLY when the line explicitly states a duration (e.g. "30 min", "2 hours"). Otherwise null.
- mental_effort: set ONLY when the line explicitly mentions effort level. Otherwise null.
- NEVER invent categories, dates, durations, priorities, or effort that are not grounded in the line text.
- When unsure, leave optional fields null.`;

function buildOutputSchema(count: number) {
  return z.object({
    tasks: z.array(ErgonRefineLlmTaskSchema).length(count),
  });
}

function buildPrompt(options: {
  titles: string[];
  categories: CategoryHint[];
  now: Date;
}): string {
  const categoryLines =
    options.categories.length > 0
      ? options.categories.map((c) => `- ${c.name}`).join("\n")
      : "(none)";

  const numberedTitles = options.titles.map((title, index) => `[${index}] ${title}`).join("\n");

  return [
    `Anchor datetime (for relative dates): ${options.now.toISOString()}`,
    "",
    "Known categories (only use names from this list):",
    categoryLines,
    "",
    "Todo lines to refine:",
    numberedTitles,
  ].join("\n");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Ergon refine timed out"));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function refineTasksWithLlm(options: {
  titles: string[];
  categories: CategoryHint[];
  now?: Date;
}): Promise<Result<ErgonRefineLlmTask[]>> {
  const now = options.now ?? new Date();
  const count = options.titles.length;
  const schema = buildOutputSchema(count);
  const prompt = buildPrompt({ titles: options.titles, categories: options.categories, now });

  try {
    const start = performance.now();

    const { object, usage } = await withTimeout(
      generateObject({
        model: ERGON_REFINE_MODEL,
        system: ERGON_REFINE_SYSTEM,
        prompt,
        schema,
        maxOutputTokens: Math.min(120 * count + 80, 1_200),
        providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
      }),
      ERGON_REFINE_TIMEOUT_MS
    );

    const durationMs = performance.now() - start;

    recordLlmCall({
      model: ERGON_REFINE_MODEL,
      usage,
      durationMs,
      metadata: { operation: "ergonRefineQuickAdd" },
    });

    return { data: object.tasks, error: null };
  } catch (err) {
    logger.error("refineTasksWithLlm", err instanceof Error ? err.message : String(err));

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to refine tasks"),
    };
  }
}
