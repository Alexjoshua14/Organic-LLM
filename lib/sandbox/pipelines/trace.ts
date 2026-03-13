/**
 * Generic trace shape returned by scenario pipelines for the debug panel.
 */

export interface PipelineTrace {
  rawInput: unknown;
  transformedPrompt?: string;
  modelOrFunction: string;
  latencyMs: number;
  error?: string;
  errorStack?: string;
  intermediateOutputs?: Record<string, unknown>;
  normalizedProps?: unknown;
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
  };
}
