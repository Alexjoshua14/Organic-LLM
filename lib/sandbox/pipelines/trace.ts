/**
 * Generic trace shape returned by scenario pipelines for the debug panel.
 */

/** Token usage from a single model/call (AI SDK–compatible). */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

/** Per-call usage for breakdown by model or function. */
export interface TokenUsageEntry {
  modelOrFunction: string;
  usage: TokenUsage;
}

export interface PipelineTrace {
  rawInput: unknown;
  transformedPrompt?: string;
  modelOrFunction: string;
  latencyMs: number;
  error?: string;
  errorStack?: string;
  intermediateOutputs?: Record<string, unknown>;
  normalizedProps?: unknown;
  /** Aggregate token usage when a single call (or sum when multiple). */
  tokenUsage?: TokenUsage;
  /** Per-call breakdown when multiple models/functions are invoked. */
  tokenUsageByCall?: TokenUsageEntry[];
}

export function createTrace(
  rawInput: unknown,
  modelOrFunction: string,
  latencyMs: number,
  options?: {
    transformedPrompt?: string;
    error?: Error | string;
    intermediateOutputs?: Record<string, unknown>;
    normalizedProps?: unknown;
    tokenUsage?: TokenUsage;
    tokenUsageByCall?: TokenUsageEntry[];
  }
): PipelineTrace {
  const errorMessage =
    options?.error instanceof Error
      ? options.error.message
      : typeof options?.error === "string"
        ? options.error
        : undefined;
  const errorStack =
    options?.error instanceof Error ? options.error.stack : undefined;

  return {
    rawInput,
    transformedPrompt: options?.transformedPrompt,
    modelOrFunction,
    latencyMs,
    error: errorMessage,
    errorStack,
    intermediateOutputs: options?.intermediateOutputs,
    normalizedProps: options?.normalizedProps,
    tokenUsage: options?.tokenUsage,
    tokenUsageByCall: options?.tokenUsageByCall,
  };
}

/** Normalize AI SDK usage (or similar) into TokenUsage. */
export function normalizeUsage(usage: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  reasoningTokens?: number | null;
}): TokenUsage {
  return {
    inputTokens: usage.inputTokens ?? usage.promptTokens ?? undefined,
    outputTokens: usage.outputTokens ?? usage.completionTokens ?? undefined,
    promptTokens: usage.promptTokens ?? usage.inputTokens ?? undefined,
    completionTokens: usage.completionTokens ?? usage.outputTokens ?? undefined,
    totalTokens: usage.totalTokens ?? undefined,
    reasoningTokens: usage.reasoningTokens ?? undefined,
  };
}
