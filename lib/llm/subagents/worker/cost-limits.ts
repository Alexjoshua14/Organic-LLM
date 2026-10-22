import type { ModelMessage, PrepareStepFunction, ToolSet } from "ai";

import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { AGENT_MODEL } from "@/lib/llm/helpers";
import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";
import { models } from "@/lib/schemas/chat-models";

export const SUBAGENT_TOTAL_OUTPUT_TOKENS = 16_000;
/** Estimated input includes messages, instructions and serialized tool schemas on every step. */
export const SUBAGENT_MAX_INPUT_TOKENS = 24_000;
/**
 * Hard per-run USD ceiling. The next step wraps up once spend reaches 80% of this,
 * and no further model call starts once spend reaches the ceiling.
 */
export const SUBAGENT_MAX_RUN_COST_USD = 0.25;
const SUBAGENT_RUN_COST_FINISH_RATIO = 0.8;

const COMPACTION_MARKER = "\n…[compacted to stay within 24k token budget]…\n";
const FINISHING_INSTRUCTIONS_SUFFIX =
  "\n\nThis is the final step of this bounded assignment. Use the evidence already gathered, produce the requested result, and state any missing inputs or unfinished work. Do not claim completion of work you did not finish.";

export type SubagentStepUsage = {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedInputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
};

export function subagentRunLimits(research: boolean) {
  const defaults = AGENT_MODEL();

  return {
    maxOutputTokens: defaults.maxOutputTokens,
    maxSteps: research ? defaults.maxStepCount : 8,
    totalOutputTokens: SUBAGENT_TOTAL_OUTPUT_TOKENS,
    maxInputTokens: SUBAGENT_MAX_INPUT_TOKENS,
    maxRunCostUsd: SUBAGENT_MAX_RUN_COST_USD,
  };
}

function estimateStepInputTokens(
  instructions: string,
  toolSchemaText: string,
  messages: ReadonlyArray<ModelMessage>
): number {
  return estimateTokenCountSync(`${instructions}\n${toolSchemaText}\n${JSON.stringify(messages)}`);
}

export function compactTextMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const available = Math.max(40, maxChars - COMPACTION_MARKER.length);
  const headChars = Math.max(24, Math.floor(available * 0.68));
  const tailChars = Math.max(16, available - headChars);

  return `${text.slice(0, headChars)}${COMPACTION_MARKER}${text.slice(text.length - tailChars)}`;
}

function compactToolOutput(output: unknown, maxChars: number): unknown {
  if (!output || typeof output !== "object") {
    return {
      type: "text",
      value: compactTextMiddle(
        typeof output === "string" ? output : JSON.stringify(output ?? ""),
        maxChars
      ),
    };
  }

  const typed = output as { type?: unknown; value?: unknown };

  if ((typed.type === "text" || typed.type === "error-text") && typeof typed.value === "string") {
    return { ...output, value: compactTextMiddle(typed.value, maxChars) };
  }

  if (typed.type === "json" || typed.type === "error-json") {
    const serialized =
      typeof typed.value === "string" ? typed.value : JSON.stringify(typed.value ?? null);

    if (serialized.length <= maxChars) return output;

    return { ...output, value: compactTextMiddle(serialized, maxChars) };
  }

  if (typed.type === "content" && Array.isArray(typed.value)) {
    const value = typed.value.map((part) => {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return {
          ...(part as Record<string, unknown>),
          text: compactTextMiddle((part as { text: string }).text, maxChars),
        };
      }

      return part;
    });
    const compacted = { ...output, value };

    if (JSON.stringify(compacted).length <= maxChars) return compacted;
  }

  if (typed.type === "execution-denied") return output;

  return {
    type: "text",
    value: compactTextMiddle(JSON.stringify(output), maxChars),
  };
}

function compactUnknownPayload(value: unknown, maxChars: number): unknown {
  if (typeof value === "string") {
    return compactTextMiddle(value, maxChars);
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  const serialized = JSON.stringify(value);

  if (serialized.length <= maxChars) return value;

  if (
    "type" in value &&
    "value" in value &&
    (value as { type?: unknown }).type === "text" &&
    typeof (value as { value?: unknown }).value === "string"
  ) {
    return {
      ...value,
      value: compactTextMiddle((value as { value: string }).value, maxChars),
    };
  }

  if ("type" in value && "value" in value && (value as { type?: unknown }).type === "json") {
    const innerSerialized = JSON.stringify((value as { value: unknown }).value);

    return {
      ...value,
      value: {
        compacted: true,
        preview: compactTextMiddle(innerSerialized, maxChars),
      },
    };
  }

  return {
    compacted: true,
    preview: compactTextMiddle(serialized, maxChars),
  };
}

function compactMessageAtTier(
  message: ModelMessage,
  maxChars: number,
  options?: { compactUserText?: boolean }
): ModelMessage {
  if (message.role === "tool") {
    if (typeof message.content === "string") {
      return {
        ...message,
        content: compactTextMiddle(message.content, maxChars),
      } as unknown as ModelMessage;
    }
    if (Array.isArray(message.content)) {
      const nextContent = message.content.map((part) => {
        if (!part || typeof part !== "object") return part;
        const copy: Record<string, unknown> = { ...(part as Record<string, unknown>) };

        if ("output" in copy && copy.output !== undefined) {
          copy.output = compactToolOutput(copy.output, maxChars);
        }
        if ("result" in copy && copy.result !== undefined) {
          copy.result =
            typeof copy.result === "string"
              ? compactTextMiddle(copy.result, maxChars)
              : compactUnknownPayload(copy.result, maxChars);
        }
        if ("content" in copy && copy.content !== undefined) {
          copy.content =
            typeof copy.content === "string"
              ? compactTextMiddle(copy.content, maxChars)
              : compactUnknownPayload(copy.content, maxChars);
        }

        return copy;
      });

      return { ...message, content: nextContent } as unknown as ModelMessage;
    }
  }

  if (message.role === "assistant") {
    if (typeof message.content === "string") {
      return {
        ...message,
        content: compactTextMiddle(message.content, maxChars),
      };
    }
    if (Array.isArray(message.content)) {
      const nextContent = message.content.map((part) => {
        if (!part || typeof part !== "object") return part;
        const copy: Record<string, unknown> = { ...(part as Record<string, unknown>) };

        if (copy.type === "text" && typeof copy.text === "string") {
          copy.text = compactTextMiddle(copy.text, maxChars);
        } else if (copy.type === "tool-result" && "output" in copy && copy.output !== undefined) {
          copy.output = compactToolOutput(copy.output, maxChars);
        } else if (copy.type === "tool-call" && maxChars <= 1_000) {
          if ("input" in copy && copy.input !== undefined) {
            copy.input = compactUnknownPayload(copy.input, maxChars);
          }
          if ("args" in copy && copy.args !== undefined) {
            copy.args = compactUnknownPayload(copy.args, maxChars);
          }
        }

        return copy;
      });

      return { ...message, content: nextContent } as unknown as ModelMessage;
    }
  }

  if (message.role === "user" && options?.compactUserText) {
    if (typeof message.content === "string") {
      return {
        ...message,
        content: compactTextMiddle(message.content, maxChars),
      };
    }
    if (Array.isArray(message.content)) {
      const nextContent = message.content.map((part) => {
        if (!part || typeof part !== "object") return part;
        const copy: Record<string, unknown> = { ...(part as Record<string, unknown>) };

        if (copy.type === "text" && typeof copy.text === "string") {
          copy.text = compactTextMiddle(copy.text, maxChars);
        }

        return copy;
      });

      return { ...message, content: nextContent } as unknown as ModelMessage;
    }
  }

  return message;
}

function hasToolActivity(messages: ReadonlyArray<ModelMessage>): boolean {
  return messages.some((m) => {
    if (m.role === "tool") return true;
    if (!Array.isArray(m.content)) return false;

    return m.content.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part.type === "tool-result" || part.type === "tool-call")
    );
  });
}

function summarizeDroppedStepMessages(dropped: ReadonlyArray<ModelMessage>): string {
  const snippets: string[] = [];

  for (const msg of dropped) {
    const raw = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

    if (raw) {
      snippets.push(compactTextMiddle(raw, 220));
    }
  }

  return `[Earlier intermediate tool outputs compacted (${dropped.length} messages): ${snippets.slice(0, 4).join(" | ")}]`;
}

/**
 * Multi-pass compaction for subagent worker steps when accumulated tool results or thread history
 * push the next step above `SUBAGENT_MAX_INPUT_TOKENS` (24k).
 *
 * A single uncompactable step-0 user message is left untouched so preflight hard-gate contracts hold.
 */
export function compactSubagentStepMessages(args: {
  messages: ModelMessage[];
  instructions: string;
  toolSchemaText: string;
  maxInputTokens?: number;
  stepNumber?: number;
}): {
  messages: ModelMessage[];
  compacted: boolean;
  estimatedInputTokens: number;
} {
  const maxInputTokens = args.maxInputTokens ?? SUBAGENT_MAX_INPUT_TOKENS;
  const initialTokens = estimateStepInputTokens(
    args.instructions,
    args.toolSchemaText,
    args.messages
  );

  if (initialTokens <= maxInputTokens) {
    return {
      messages: args.messages,
      compacted: false,
      estimatedInputTokens: initialTokens,
    };
  }

  const stepNumber = args.stepNumber ?? 0;
  const toolActivity = hasToolActivity(args.messages);

  // Preserve the exact hard gate when step 0 has only a single huge user message and no tool parts.
  if (stepNumber === 0 && args.messages.length <= 1 && !toolActivity) {
    return {
      messages: args.messages,
      compacted: false,
      estimatedInputTokens: initialTokens,
    };
  }

  const overheadTokens = estimateTokenCountSync(`${args.instructions}\n${args.toolSchemaText}`);

  if (overheadTokens >= maxInputTokens) {
    return {
      messages: args.messages,
      compacted: false,
      estimatedInputTokens: initialTokens,
    };
  }

  let working = [...args.messages];
  let lastToolIndex = -1;

  for (let i = working.length - 1; i >= 0; i -= 1) {
    if (working[i]?.role === "tool") {
      lastToolIndex = i;
      break;
    }
  }

  const shrinkTo = (maxChars: number, preserveNewestTool: boolean) => {
    working = working.map((msg, index) =>
      preserveNewestTool && index === lastToolIndex ? msg : compactMessageAtTier(msg, maxChars)
    );

    return estimateStepInputTokens(args.instructions, args.toolSchemaText, working);
  };

  // Pass 1: truncate older tool results first, then the newest result if the step is still over.
  for (const maxChars of [6_000, 2_400, 1_000, 400, 180]) {
    const tokens = shrinkTo(maxChars, lastToolIndex >= 0);

    if (tokens <= maxInputTokens) {
      return { messages: working, compacted: true, estimatedInputTokens: tokens };
    }
  }

  for (const maxChars of [8_000, 3_000, 1_200, 400, 180]) {
    const tokens = shrinkTo(maxChars, false);

    if (tokens <= maxInputTokens) {
      return { messages: working, compacted: true, estimatedInputTokens: tokens };
    }
  }

  // Pass 2: drop older history turns before the latest user assignment message.
  let lastUserIdx = -1;

  for (let i = working.length - 1; i >= 0; i -= 1) {
    if (working[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  while (lastUserIdx > 0) {
    do {
      working = working.slice(1);
      lastUserIdx -= 1;
    } while (working[0]?.role === "tool" && lastUserIdx > 0);

    const tokens = estimateStepInputTokens(args.instructions, args.toolSchemaText, working);

    if (tokens <= maxInputTokens) {
      return { messages: working, compacted: true, estimatedInputTokens: tokens };
    }
  }

  // Pass 3: if intermediate tool turns after the assignment still exceed budget, collapse older
  // intermediate turns while keeping the assignment user message and the most recent tool pair.
  if (working.length > 3 && lastUserIdx === 0) {
    const assignmentMsg = working[0]!;
    const tail = working.slice(-2);
    const dropped = working.slice(1, -2);
    const summaryNote = summarizeDroppedStepMessages(dropped);
    const updatedAssignment: ModelMessage =
      typeof assignmentMsg.content === "string"
        ? { ...assignmentMsg, content: `${assignmentMsg.content}\n\n${summaryNote}` }
        : assignmentMsg;

    working = [updatedAssignment, ...tail];
    const tokens = estimateStepInputTokens(args.instructions, args.toolSchemaText, working);

    if (tokens <= maxInputTokens) {
      return { messages: working, compacted: true, estimatedInputTokens: tokens };
    }
  }

  // Final fallback for step > 0 when the assignment + latest tool pair still needs trimming.
  if (stepNumber > 0 || toolActivity) {
    let charBudget = Math.max(
      160,
      Math.floor(
        (Math.max(200, maxInputTokens - overheadTokens - 150) * 3) / Math.max(1, working.length)
      )
    );
    let tokens = estimateStepInputTokens(args.instructions, args.toolSchemaText, working);

    while (tokens > maxInputTokens && charBudget >= 80) {
      working = working.map((msg) =>
        compactMessageAtTier(msg, charBudget, { compactUserText: true })
      );
      tokens = estimateStepInputTokens(args.instructions, args.toolSchemaText, working);
      if (tokens <= maxInputTokens) break;
      charBudget = Math.floor(charBudget / 2);
    }

    return { messages: working, compacted: true, estimatedInputTokens: tokens };
  }

  return {
    messages: working,
    compacted: true,
    estimatedInputTokens: estimateStepInputTokens(args.instructions, args.toolSchemaText, working),
  };
}

export function estimateSubagentStepsCostUsd(
  steps: ReadonlyArray<{ usage: SubagentStepUsage }>,
  modelId: string = models.anthropic.haiku.id
): number {
  return steps.reduce((sum, step) => {
    const inputTokens = step.usage.inputTokens ?? step.usage.promptTokens ?? 0;
    const outputTokens = step.usage.outputTokens ?? step.usage.completionTokens ?? 0;
    const cachedInputTokens =
      step.usage.cachedInputTokens ?? step.usage.inputTokenDetails?.cacheReadTokens ?? 0;

    return (
      sum +
      computeUsageCostUsd(modelId, {
        inputTokens,
        outputTokens,
        cachedInputTokens,
      })
    );
  }, 0);
}

/** Leave the plan gate in control; this policy only narrows what the next call may spend. */
export function prepareSubagentStep(args: {
  stepNumber: number;
  steps: ReadonlyArray<{ usage: SubagentStepUsage }>;
  messages: ModelMessage[];
  instructions: string;
  toolSchemaText: string;
  research: boolean;
  modelId?: string;
  maxRunCostUsd?: number;
}) {
  const limits = subagentRunLimits(args.research);
  const maxRunCostUsd = args.maxRunCostUsd ?? limits.maxRunCostUsd;
  const effectiveModelId = args.modelId ?? models.anthropic.haiku.id;
  // Missing provider usage must not turn the total allowance into an unlimited loop.
  const usedOutput = args.steps.reduce(
    (sum, step) =>
      sum + (step.usage.outputTokens ?? step.usage.completionTokens ?? limits.maxOutputTokens),
    0
  );
  const remainingOutput = limits.totalOutputTokens - usedOutput;

  if (args.stepNumber >= limits.maxSteps || remainingOutput <= 0) {
    throw new Error("Subagent run allowance exhausted; no further model call was started.");
  }

  const usedCostUsd = estimateSubagentStepsCostUsd(args.steps, effectiveModelId);

  if (usedCostUsd >= maxRunCostUsd) {
    throw new Error(
      `Subagent run allowance exhausted (cost $${usedCostUsd.toFixed(4)} reached $${maxRunCostUsd.toFixed(2)} ceiling); no further model call was started.`
    );
  }

  // A full next step at the input cap can cross $0.25 before the 80% mark on pricier models.
  const projectedFullStepUsd = computeUsageCostUsd(effectiveModelId, {
    inputTokens: limits.maxInputTokens,
    outputTokens: limits.maxOutputTokens,
  });
  const costFinishing =
    usedCostUsd >= maxRunCostUsd * SUBAGENT_RUN_COST_FINISH_RATIO ||
    usedCostUsd + projectedFullStepUsd >= maxRunCostUsd;

  let finishing =
    args.stepNumber === limits.maxSteps - 1 ||
    remainingOutput <= limits.maxOutputTokens ||
    costFinishing;
  const finishingInstructions = `${args.instructions}${FINISHING_INSTRUCTIONS_SUFFIX}`;
  let instructions = finishing ? finishingInstructions : args.instructions;
  let messages = args.messages;
  let compactedMessages = false;
  let inputTokens = estimateStepInputTokens(instructions, args.toolSchemaText, messages);

  if (inputTokens > limits.maxInputTokens) {
    // When compacting mid-run, target the finishing instructions budget so we can wrap up cleanly.
    const targetInstructions = finishingInstructions;
    const compacted = compactSubagentStepMessages({
      messages: args.messages,
      instructions: targetInstructions,
      toolSchemaText: args.toolSchemaText,
      maxInputTokens: limits.maxInputTokens,
      stepNumber: args.stepNumber,
    });

    if (compacted.compacted && compacted.estimatedInputTokens <= limits.maxInputTokens) {
      messages = compacted.messages;
      compactedMessages = true;
      finishing = true;
      instructions = targetInstructions;
      inputTokens = compacted.estimatedInputTokens;
    } else if (compacted.estimatedInputTokens < inputTokens) {
      inputTokens = compacted.estimatedInputTokens;
    }
  }

  if (inputTokens > limits.maxInputTokens) {
    throw new Error(
      `Subagent input exceeds its cost limit (${inputTokens} estimated tokens; limit ${limits.maxInputTokens}). Send a smaller assignment or less context.`
    );
  }

  return {
    maxOutputTokens: Math.min(limits.maxOutputTokens, remainingOutput),
    ...(finishing ? { toolChoice: "none" as const, instructions } : {}),
    ...(compactedMessages ? { messages } : {}),
  };
}

export function withSubagentCostLimits<
  T extends {
    prepareStep(): Promise<unknown>;
  },
>(
  budgetHooks: T,
  args: {
    instructions: string;
    toolSchemaText: string;
    research: boolean;
    modelId?: string;
    maxRunCostUsd?: number;
  }
) {
  const prepareStep: PrepareStepFunction<ToolSet> = async ({ stepNumber, steps, messages }) => {
    await budgetHooks.prepareStep();

    return prepareSubagentStep({ ...args, stepNumber, steps, messages });
  };

  return { ...budgetHooks, prepareStep };
}
