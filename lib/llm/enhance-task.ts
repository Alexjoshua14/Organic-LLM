import type { ErgonEnhanceFields } from "@/lib/schemas/ergon-enhance";
import type { Result } from "@/types";

import { generateObject } from "ai";

import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { ErgonEnhanceFieldsSchema } from "@/lib/schemas/ergon-enhance";

const logger = createLogger("lib/llm/enhance-task.ts");

export const ERGON_ENHANCE_MODEL = "openai/gpt-5.4-nano" as const;
export const ERGON_ENHANCE_TIMEOUT_MS = 6_000;

const ENHANCE_SYSTEM = `You enrich a single todo by inferring values for ONLY the fields the user left empty, using the task's meaning plus the user's categories, their other tasks, and any memory provided.

Rules:
- category_name: choose ONLY from the provided category list (return the exact name) when one clearly fits the task's meaning. Never invent a new category. If none fit, return null.
- priority, est_minutes, mental_effort: set sensible values for this kind of task when they are empty. Keep estimates realistic.
- planned_date / due_date: set ONLY when there is a genuine time signal (an explicit deadline or plan in the task notes or memory). For ordinary tasks with no time signal, return null. Never guess dates.
- Only fill fields listed as empty. Return null for anything you are not confident about — prefer a few high-quality fields over filling everything.
- Dates are absolute YYYY-MM-DD resolved against the current date.`;

type EnhanceTaskContext = {
  task: { title: string; notes: string | null; emptyFields: string[] };
  categories: string[];
  otherTasks: { title: string; category: string | null }[];
  memory: string[];
  now?: Date;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Ergon enhance timed out")), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildPrompt(ctx: EnhanceTaskContext, now: Date): string {
  const categories = ctx.categories.length > 0 ? ctx.categories.join(", ") : "(none yet)";
  const others =
    ctx.otherTasks.length > 0
      ? ctx.otherTasks
          .map((t) => `- ${t.title}${t.category ? ` [${t.category}]` : ""}`)
          .join("\n")
      : "(none)";
  const memory = ctx.memory.length > 0 ? ctx.memory.map((m) => `- ${m}`).join("\n") : "(none)";

  return [
    `Current date: ${now.toISOString().slice(0, 10)}`,
    "",
    `Existing categories (choose from these only): ${categories}`,
    "",
    "The user's other tasks (for context and patterns):",
    others,
    "",
    "Relevant memory about the user:",
    memory,
    "",
    "Task to enrich:",
    `- title: ${ctx.task.title}`,
    `- notes: ${ctx.task.notes?.trim() || "(none)"}`,
    `- empty fields you may fill: ${ctx.task.emptyFields.join(", ") || "(none)"}`,
  ].join("\n");
}

/** Infer values for a task's empty fields. Grounded by the merge step that consumes this. */
export async function enhanceTaskFields(
  ctx: EnhanceTaskContext
): Promise<Result<ErgonEnhanceFields>> {
  const now = ctx.now ?? new Date();

  try {
    const start = performance.now();

    const { object, usage } = await withTimeout(
      generateObject({
        model: ERGON_ENHANCE_MODEL,
        system: ENHANCE_SYSTEM,
        prompt: buildPrompt(ctx, now),
        schema: ErgonEnhanceFieldsSchema,
        maxOutputTokens: 300,
        providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
      }),
      ERGON_ENHANCE_TIMEOUT_MS
    );

    recordLlmCall({
      model: ERGON_ENHANCE_MODEL,
      usage,
      durationMs: performance.now() - start,
      metadata: { operation: "ergonEnhanceTask" },
    });

    return { data: object, error: null };
  } catch (err) {
    logger.error("enhanceTaskFields", err instanceof Error ? err.message : String(err));

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to enhance task"),
    };
  }
}
