"use server";

import type { RabbitHoleBranchSuggestion } from "@/lib/schemas/rabbitHoleSchemas";
import type { PipelineTrace } from "./trace";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import { createTrace, normalizeUsage } from "./trace";

import { generateTitle, generateBranchSuggestions } from "@/lib/llm/rabbit-hole/generation";
import { REFINE_QUESTION_SYSTEM_PROMPT } from "@/lib/system-prompt/rabbit-hole";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";

export type RabbitHoleTitleRunResult = {
  title: string | null;
  trace: PipelineTrace;
};

export type BranchSuggestionRunResult = {
  branches: RabbitHoleBranchSuggestion[];
  trace: PipelineTrace;
};

export type QuestionRefinementRunResult = {
  refinedQuestion: string | null;
  trace: PipelineTrace;
};

/**
 * Scenario pipeline: title generation from HTML/text.
 * Calls real generateTitle and returns result + trace.
 */
export async function runRabbitHoleTitleScenario(html: string): Promise<RabbitHoleTitleRunResult> {
  const start = performance.now();
  const rawInput = { html };

  try {
    const { data: title, error, usage } = await generateTitle({ html });
    const latencyMs = performance.now() - start;

    const trace = createTrace(rawInput, "generateTitle", latencyMs, {
      transformedPrompt: html.slice(0, 500) + (html.length > 500 ? "…" : ""),
      error: error ?? undefined,
      normalizedProps: title != null ? { title } : undefined,
      tokenUsage: usage ? normalizeUsage(usage) : undefined,
      tokenUsageByCall: usage
        ? [{ modelOrFunction: "generateTitle", usage: normalizeUsage(usage) }]
        : undefined,
    });

    return {
      title: title ?? null,
      trace,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const trace = createTrace(rawInput, "generateTitle", latencyMs, {
      error: err instanceof Error ? err : new Error(String(err)),
    });

    return {
      title: null,
      trace,
    };
  }
}

/**
 * Scenario pipeline: branch suggestions from context.
 * Calls real generateBranchSuggestions and returns result + trace.
 */
export async function runBranchSuggestionScenario(params: {
  context: string;
  rootQuestion?: string;
  pathHistory?: string;
}): Promise<BranchSuggestionRunResult> {
  const start = performance.now();
  const rawInput = { ...params };

  try {
    const {
      data: branches,
      error,
      usage,
    } = await generateBranchSuggestions({
      context: params.context,
      rootQuestion: params.rootQuestion,
      pathHistory: params.pathHistory,
    });
    const latencyMs = performance.now() - start;

    const trace = createTrace(rawInput, "generateBranchSuggestions", latencyMs, {
      error: error ?? undefined,
      normalizedProps: branches != null ? { branches, count: branches.length } : undefined,
      tokenUsage: usage ? normalizeUsage(usage) : undefined,
      tokenUsageByCall: usage
        ? [
            {
              modelOrFunction: "generateBranchSuggestions",
              usage: normalizeUsage(usage),
            },
          ]
        : undefined,
    });

    return {
      branches: branches ?? [],
      trace,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const trace = createTrace(rawInput, "generateBranchSuggestions", latencyMs, {
      error: err instanceof Error ? err : new Error(String(err)),
    });

    return {
      branches: [],
      trace,
    };
  }
}

/**
 * Scenario pipeline: question refinement (same logic as production, no session required).
 * Returns refined question + trace.
 */
export async function runQuestionRefinementScenario(params: {
  question: string;
  pathHistory: string;
}): Promise<QuestionRefinementRunResult> {
  const start = performance.now();
  const rawInput = { ...params };
  const prompt = `Question to refine: ${params.question}\n\nPath history: ${params.pathHistory}`;

  try {
    const { text, usage } = await generateText({
      model: openai("gpt-5-nano"),
      system: REFINE_QUESTION_SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const latencyMs = performance.now() - start;
    const refinedQuestion = text?.trim() ?? null;

    const trace = createTrace(rawInput, "generateText (refine question)", latencyMs, {
      transformedPrompt: prompt,
      normalizedProps: refinedQuestion != null ? { refinedQuestion } : undefined,
      tokenUsage: usage ? normalizeUsage(usage) : undefined,
      tokenUsageByCall: usage
        ? [
            {
              modelOrFunction: "generateText (refine question)",
              usage: normalizeUsage(usage),
            },
          ]
        : undefined,
    });

    return {
      refinedQuestion,
      trace,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const trace = createTrace(rawInput, "generateText (refine question)", latencyMs, {
      transformedPrompt: prompt,
      error: err instanceof Error ? err : new Error(String(err)),
    });

    return {
      refinedQuestion: null,
      trace,
    };
  }
}
