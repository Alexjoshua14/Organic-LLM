import type { ModelMessage, PrepareStepFunction, ToolSet } from "ai";

import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { AGENT_MODEL } from "@/lib/llm/helpers";

export const SUBAGENT_TOTAL_OUTPUT_TOKENS = 16_000;
/** Estimated input includes messages, instructions and serialized tool schemas on every step. */
/** Lives here, not in prepare-input, so orchestrator-tools can read it at module load. */
export const SUBAGENT_THREAD_CONTEXT_MESSAGES = 30;
export const SUBAGENT_MAX_INPUT_TOKENS = 24_000;

export function subagentRunLimits(research: boolean) {
  const defaults = AGENT_MODEL();

  return {
    maxOutputTokens: defaults.maxOutputTokens,
    maxSteps: research ? defaults.maxStepCount : 8,
    totalOutputTokens: SUBAGENT_TOTAL_OUTPUT_TOKENS,
    maxInputTokens: SUBAGENT_MAX_INPUT_TOKENS,
  };
}

/** Leave the plan gate in control; this policy only narrows what the next call may spend. */
export function prepareSubagentStep(args: {
  stepNumber: number;
  steps: ReadonlyArray<{ usage: { outputTokens?: number } }>;
  messages: ModelMessage[];
  instructions: string;
  toolSchemaText: string;
  research: boolean;
}) {
  const limits = subagentRunLimits(args.research);
  // Missing provider usage must not turn the total allowance into an unlimited loop.
  const usedOutput = args.steps.reduce(
    (sum, step) => sum + (step.usage.outputTokens ?? limits.maxOutputTokens),
    0
  );
  const remainingOutput = limits.totalOutputTokens - usedOutput;

  if (args.stepNumber >= limits.maxSteps || remainingOutput <= 0) {
    throw new Error("Subagent run allowance exhausted; no further model call was started.");
  }
  const finishing =
    args.stepNumber === limits.maxSteps - 1 || remainingOutput <= limits.maxOutputTokens;
  const instructions = finishing
    ? `${args.instructions}\n\nThis is the final step of this bounded assignment. Use the evidence already gathered, produce the requested result, and state any missing inputs or unfinished work. Do not claim completion of work you did not finish.`
    : args.instructions;
  const inputTokens = estimateTokenCountSync(
    `${instructions}\n${args.toolSchemaText}\n${JSON.stringify(args.messages)}`
  );

  if (inputTokens > limits.maxInputTokens) {
    throw new Error(
      `Subagent input exceeds its cost limit (${inputTokens} estimated tokens; limit ${limits.maxInputTokens}). Send a smaller assignment or less context.`
    );
  }

  return {
    maxOutputTokens: Math.min(limits.maxOutputTokens, remainingOutput),
    ...(finishing ? { toolChoice: "none" as const, instructions } : {}),
  };
}

export function withSubagentCostLimits<
  T extends {
    prepareStep(): Promise<unknown>;
  },
>(budgetHooks: T, args: { instructions: string; toolSchemaText: string; research: boolean }) {
  const prepareStep: PrepareStepFunction<ToolSet> = async ({ stepNumber, steps, messages }) => {
    await budgetHooks.prepareStep();

    return prepareSubagentStep({ ...args, stepNumber, steps, messages });
  };

  return { ...budgetHooks, prepareStep };
}
