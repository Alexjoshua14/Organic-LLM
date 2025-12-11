"use server";

import { generateObject, generateText } from "ai";
import { RabbitHoleNodeSchema } from "@/app/rabbitholes/_lib/types";
import { Result } from "@/types";

import { createLogger } from "@/lib/logger";
import { openai } from "@ai-sdk/openai";

import { RabbitHoleSourceAnalysisSchema } from "@/app/rabbitholes/_lib/types";
import {
  QUICK_PREVIEW_SYSTEM_PROMPT,
  SOURCE_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/system-prompt/rabbit-hole";

const logger = createLogger("lib/llm/rabbit-hole/generation.ts");

const model = openai("gpt-5.1");
const quickModel = openai("gpt-5-nano");

// Parameters for invoking the LLM for Rabbit Hole objects with consistent logging.
type GenerateRabbitHoleObjectParams<T> = {
  logContext: string;
  startMessage: string;
  durationMessageBuilder: (durationMs: number) => string;
  keyTakeawayLabel: string;
  systemPrompt: string;
  prompt: string;
  temperature?: number;
};

/**
 * Shared helper to call the LLM and log timing/usage consistently.
 * @template T
 * @param params Parameters controlling logging, prompt, and temperature.
 * @returns Result payload containing the parsed object.
 */
export async function generateRabbitHoleObject<T>({
  logContext,
  startMessage,
  durationMessageBuilder,
  keyTakeawayLabel,
  systemPrompt,
  prompt,
  temperature,
}: GenerateRabbitHoleObjectParams<T>): Promise<Result<unknown>> {
  logger.log(logContext, startMessage);
  const aiResponseGenerationStart = performance.now();

  try {
    const { object, usage } = await generateObject({
      model,
      system: systemPrompt,
      prompt,
      schema: RabbitHoleNodeSchema,
      ...(temperature !== undefined ? { temperature } : {}),
    });

    const aiResponseGenerationEnd = performance.now();
    const durationMs = aiResponseGenerationEnd - aiResponseGenerationStart;

    logger.log(logContext, durationMessageBuilder(durationMs));

    if (usage) {
      logger.log(
        logContext,
        `AI usage: input tokens=${usage.inputTokens ?? "?"}, reasoning tokens=${usage.reasoningTokens ?? "?"}, output tokens=${usage.outputTokens ?? "?"}, total tokens=${usage.totalTokens ?? "?"}`
      );
    }

    logger.log(
      logContext,
      `${keyTakeawayLabel}: ${(object as any).keyTakeaways?.[0] ?? "(none)"}`
    );

    return { data: object, error: null };
  } catch (err) {
    logger.error("generateInitialNodeContent", JSON.stringify(err, null, 2));

    throw err;
  }
}

type GenerateSourceAnalysisParams = {
  prompt: string;
};

/**
 * Run the source analysis model with consistent schema and temperature.
 * @param params.prompt Fully assembled prompt for source analysis.
 * @returns Parsed analysis object and usage metadata.
 */
export async function generateSourceAnalysis({
  prompt,
}: GenerateSourceAnalysisParams): Promise<any> {
  const { object, usage } = await generateObject({
    model,
    system: SOURCE_ANALYSIS_SYSTEM_PROMPT,
    prompt,
    schema: RabbitHoleSourceAnalysisSchema.omit({ originalUrl: true }),
    temperature: 0.7,
  });
  return { object, usage };
}

type GenerateQuickPreviewParams = {
  prompt: string;
};

/**
 * Run the lightweight preview model for fast summaries.
 * @param params.prompt Prompt text to summarize quickly.
 * @returns Trimmed preview text.
 */
export async function generateQuickPreviewLLM({
  prompt,
}: GenerateQuickPreviewParams): Promise<{ text: string }> {
  const res = await generateText({
    model: quickModel,
    system: QUICK_PREVIEW_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 400,
    providerOptions: {
      openai: {
        reasoningEffort: "minimal",
      },
    },
  });

  return { text: res.text.trim() };
}
