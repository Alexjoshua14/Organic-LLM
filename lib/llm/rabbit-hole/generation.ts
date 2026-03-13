"use server";

import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import {
  RabbitHoleAIResponse,
  RabbitHoleAIResponseSchema,
  RabbitHoleBranchSuggestionSchema,
  RabbitHoleNodeSchema,
  RabbitHoleSourceAnalysisSchema,
} from "@/lib/schemas/rabbitHoleSchemas";
import { Result } from "@/types";

import { createLogger } from "@/lib/logger";

/** Optional usage from AI SDK (generateText / generateObject). */
type LanguageModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};
import { openai } from "@ai-sdk/openai";

import {
  BRANCH_SUGGESTIONS_SYSTEM_PROMPT,
  CREATE_TITLE_SYSTEM_PROMPT,
  QUICK_PREVIEW_SYSTEM_PROMPT,
  SOURCE_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/system-prompt/rabbit-hole";
import { z } from "zod";

const logger = createLogger("lib/llm/rabbit-hole/generation.ts");

// Used for Core content generation
const model = openai("gpt-5.2");

// Used for Branch suggestions
const quickModel = openai("gpt-5-mini");

// Used for Preview
const rapidModel = openai("gpt-5-nano");

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
}: GenerateRabbitHoleObjectParams<T>): Promise<Result<RabbitHoleAIResponse>> {
  logger.log(logContext, startMessage);
  const aiResponseGenerationStart = performance.now();

  try {
    const { object, usage } = await generateObject({
      model,
      system: systemPrompt,
      prompt,
      schema: RabbitHoleAIResponseSchema,
      maxOutputTokens: 7000,
      ...(temperature !== undefined ? { temperature } : {}),
    });

    const aiResponseGenerationEnd = performance.now();
    const durationMs = aiResponseGenerationEnd - aiResponseGenerationStart;

    logger.log(logContext, durationMessageBuilder(durationMs));

    if (usage) {
      logger.log(
        logContext,
        `AI usage: input tokens=${usage.inputTokens ?? "?"}, reasoning tokens=${usage.reasoningTokens ?? "?"}, output tokens=${usage.outputTokens ?? "?"}, total tokens=${usage.totalTokens ?? "?"}`,
      );
    }

    logger.log(
      logContext,
      `${keyTakeawayLabel}: ${(object as any).keyTakeaways?.[0] ?? "(none)"}`,
    );

    return { data: object, error: null };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.log("NoObjectGeneratedError");
      console.log("Cause:", err.cause);
      console.log("Text:", err.text);
      console.log("Response:", err.response);
      console.log("Usage:", err.usage);
      console.log("Finish Reason:", err.finishReason);
    }

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
    model: rapidModel,
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

type GenerateBranchSuggestionsParams = {
  context: string;
  rootQuestion?: string;
  pathHistory?: string;
  temperature?: number;
};

/**
 * Generate branch suggestions for a Rabbit Hole exploration.
 * @param params.context Context about the current topic/node to generate branches from.
 * @param params.rootQuestion Optional root question for the exploration.
 * @param params.pathHistory Optional path history showing the exploration so far.
 * @param params.temperature Optional temperature for generation (default: 0.7).
 * @returns Result containing an array of branch suggestions.
 */
export async function generateBranchSuggestions({
  context,
  rootQuestion,
  pathHistory,
  temperature = 0.7,
}: GenerateBranchSuggestionsParams): Promise<
  Result<z.infer<typeof RabbitHoleBranchSuggestionSchema>[]> & {
    usage?: LanguageModelUsage;
  }
> {
  const logContext = "generateBranchSuggestions";
  logger.log(
    logContext,
    `Generating branch suggestions for context: ${context.substring(0, 100)}...`,
  );

  const generationStart = performance.now();

  try {
    let prompt = `Generate interesting branch suggestions for exploring: ${context}`;

    if (rootQuestion) {
      prompt += `\n\nRoot question: ${rootQuestion}`;
    }

    if (pathHistory) {
      prompt += `\n\nExploration path so far: ${pathHistory}`;
    }

    prompt +=
      "\n\nGenerate 5-10 diverse, intriguing branch suggestions that represent natural next steps in this exploration.";

    const { object, usage } = await generateObject({
      model: quickModel,
      system: BRANCH_SUGGESTIONS_SYSTEM_PROMPT,
      prompt,
      output: "array",
      schema: RabbitHoleBranchSuggestionSchema,
      temperature,
    });

    const generationEnd = performance.now();
    const durationMs = generationEnd - generationStart;

    logger.log(
      logContext,
      `Branch suggestions generated in ${durationMs.toFixed(2)} ms (${object.length} suggestions)`,
    );

    if (usage) {
      logger.log(
        logContext,
        `AI usage: input tokens=${usage.inputTokens ?? "?"}, reasoning tokens=${usage.reasoningTokens ?? "?"}, output tokens=${usage.outputTokens ?? "?"}, total tokens=${usage.totalTokens ?? "?"}`,
      );
    }

    return {
      data: object,
      error: null,
      usage: usage ?? undefined,
    };
  } catch (err) {
    logger.error(
      logContext,
      `Error generating branch suggestions: ${err instanceof Error ? err.message : "Unknown error"}`,
    );

    if (NoObjectGeneratedError.isInstance(err)) {
      console.log("NoObjectGeneratedError in generateBranchSuggestions");
      console.log("Cause:", err.cause);
      console.log("Text:", err.text);
      console.log("Response:", err.response);
      console.log("Usage:", err.usage);
      console.log("Finish Reason:", err.finishReason);
    }

    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

export async function generateTitle({
  html,
}: {
  html: string;
}): Promise<Result<string> & { usage?: LanguageModelUsage }> {
  let res;
  try {
    res = await generateText({
      model: quickModel,
      system: CREATE_TITLE_SYSTEM_PROMPT,
      prompt: html,
      maxOutputTokens: 80,
    });

    logger.log("generateTitle", `Title generated: ${res.text.trim()}`);
  } catch (error) {
    logger.error("generateTitle", `Error generating title: ${error}`);
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }

  return {
    data: res.text.trim(),
    error: null,
    usage: res.usage ?? undefined,
  };
}
