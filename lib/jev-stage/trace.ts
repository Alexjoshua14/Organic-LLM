import type { JevStageModelCallTrace, JevStageTurnInsight } from "./schema";

import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";

export function startCallClock() {
  return { started: performance.now(), firstTokenAt: null as number | null };
}

export function markFirstToken(clock: { firstTokenAt: number | null }) {
  if (clock.firstTokenAt == null) clock.firstTokenAt = performance.now();
}

export function finishModelCall(args: {
  id: string;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  clock: { started: number; firstTokenAt: number | null };
}): JevStageModelCallTrace {
  const latencyMs = Math.round(performance.now() - args.clock.started);
  const timeToFirstTokenMs =
    args.clock.firstTokenAt == null ? null : Math.round(args.clock.firstTokenAt - args.clock.started);
  const costUsd = computeUsageCostUsd(args.model, {
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    cachedInputTokens: args.cachedInputTokens ?? 0,
  });
  const tokensPerSecond =
    latencyMs > 0 ? Math.round((args.outputTokens / latencyMs) * 1000 * 10) / 10 : null;

  return {
    id: args.id,
    operation: args.operation,
    model: args.model,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    cachedInputTokens: args.cachedInputTokens ?? 0,
    costUsd,
    latencyMs,
    timeToFirstTokenMs,
    tokensPerSecond,
  };
}

export function summarizeCalls(calls: ReadonlyArray<JevStageModelCallTrace>) {
  const perModelSpendUsd: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let costUsd = 0;
  let latencyMs = 0;

  for (const call of calls) {
    inputTokens += call.inputTokens;
    outputTokens += call.outputTokens;
    cachedInputTokens += call.cachedInputTokens;
    costUsd += call.costUsd;
    latencyMs += call.latencyMs;
    perModelSpendUsd[call.model] = (perModelSpendUsd[call.model] ?? 0) + call.costUsd;
  }

  return {
    totals: { inputTokens, outputTokens, cachedInputTokens, costUsd, latencyMs },
    perModelSpendUsd,
  };
}

export function withCallSummary(
  insight: Omit<JevStageTurnInsight, "totals" | "perModelSpendUsd"> & {
    totals?: JevStageTurnInsight["totals"];
    perModelSpendUsd?: JevStageTurnInsight["perModelSpendUsd"];
  }
): JevStageTurnInsight {
  const { totals, perModelSpendUsd } = summarizeCalls(insight.calls);

  return { ...insight, totals, perModelSpendUsd };
}
