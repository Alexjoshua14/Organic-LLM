import type { UIMessage } from "ai";

import { isToolUIPart } from "ai";

export type LlmProcessingIntensityTier = "idle" | "light" | "working" | "intense" | "limit-near";

export type OrganicActivityState = "idle" | "working" | "blocked" | "complete";

export type LlmProcessingTelemetryInput = {
  /** Main or drawer turn actively streaming. */
  isStreaming?: boolean;
  /** Workers currently `"queued"` or `"working"`. */
  activeSubagentCount?: number;
  /** Workers that have completed in the session/thread. */
  completedSubagentCount?: number;
  /** Tool calls invoked in active turn/session. */
  toolCallCount?: number;
  /** Tokens used in current turn/session. */
  estimatedTokensUsed?: number;
  /** Soft cap for normalizing session token burn (defaults to 24,000). */
  tokenSoftCap?: number;
  /** Spent USD from user's weekly plan budget snapshot. */
  planSpentUsd?: number;
  /** Limit USD from user's weekly plan budget snapshot. */
  planLimitUsd?: number | null;
  /** Spent USD in the current turn. */
  turnSpentUsd?: number;
  /** Hard limit USD for the current turn. */
  turnHardLimitUsd?: number | null;
  /** Whether Zero Data Retention is active for this session. */
  zeroDataRetention?: boolean;
};

export type LlmProcessingIntensitySnapshot = {
  /** Normalized intensity in `[0, 1]`. */
  intensity: number;
  /** Discrete intensity tier for UI badges and telemetry. */
  tier: LlmProcessingIntensityTier;
  /** Target state for `OrganicActivityMark`. */
  markState: OrganicActivityState;
  /** Multiplier in `[0.85, 1.85]` for activity-mark physics cadence/amplitude & glass brightness. */
  motionScale: number;
  /** Budget utilization ratio in `[0, 1]`, or `null` when unknown/uncapped. */
  budgetUtilizationRatio: number | null;
  /** Remaining plan/turn budget in USD, or `null` when unknown/uncapped. */
  budgetRemainingUsd: number | null;
  /** Concise human-readable status label. */
  label: string;
};

export const DEFAULT_TOKEN_SOFT_CAP = 24_000;
export const MOTION_SCALE_MIN = 0.85;
export const MOTION_SCALE_MAX = 1.85;
const BUDGET_NEAR_LIMIT_RATIO = 0.8;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;

  return Math.max(min, Math.min(max, value));
}

function safeNonNegative(value: number | undefined | null): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;

  return value;
}

function roundTo(value: number, decimals = 3): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export function formatCompactTokenCount(tokens: number): string {
  const safe = Math.round(safeNonNegative(tokens));

  if (safe >= 1_000_000) {
    const millions = safe / 1_000_000;

    return `${millions >= 10 ? Math.round(millions) : Number(millions.toFixed(1))}M`;
  }

  if (safe >= 1_000) {
    const thousands = safe / 1_000;

    return `${thousands >= 100 ? Math.round(thousands) : Number(thousands.toFixed(1))}k`;
  }

  return String(safe);
}

export function resolveIntensityTierFromScore(
  intensity: number,
  options?: { budgetUtilizationRatio?: number | null; isWorking?: boolean }
): LlmProcessingIntensityTier {
  const safeIntensity = clamp(intensity, 0, 1);
  const budgetRatio = options?.budgetUtilizationRatio ?? null;

  if (budgetRatio !== null && budgetRatio >= BUDGET_NEAR_LIMIT_RATIO) {
    return "limit-near";
  }

  if (safeIntensity <= 0.16 && !options?.isWorking) {
    return "idle";
  }

  if (safeIntensity < 0.42) {
    return "light";
  }

  if (safeIntensity < 0.72) {
    return "working";
  }

  return "intense";
}

function buildIntensityLabel(args: {
  tier: LlmProcessingIntensityTier;
  isStreaming: boolean;
  activeSubagents: number;
  completedSubagents: number;
  toolCalls: number;
  estimatedTokensUsed: number;
  budgetUtilizationRatio: number | null;
  zeroDataRetention: boolean;
}): string {
  const {
    tier,
    isStreaming,
    activeSubagents,
    completedSubagents,
    toolCalls,
    estimatedTokensUsed,
    budgetUtilizationRatio,
  } = args;

  const segments: string[] = [];
  const budgetPct =
    budgetUtilizationRatio !== null ? Math.round(clamp(budgetUtilizationRatio, 0, 1) * 100) : null;

  if (tier === "limit-near") {
    if (budgetUtilizationRatio !== null && budgetUtilizationRatio >= 1) {
      segments.push("Limit reached");
    } else if (activeSubagents > 1) {
      segments.push(`Mesh ×${activeSubagents} working`);
    } else {
      segments.push("High load");
    }

    if (toolCalls > 0 && activeSubagents > 1) {
      segments.push(`${toolCalls} ${toolCalls === 1 ? "tool" : "tools"}`);
    }

    if (budgetPct !== null) {
      segments.push(`${budgetPct}% plan limit`);
    } else if (estimatedTokensUsed > 0) {
      segments.push(`${formatCompactTokenCount(estimatedTokensUsed)} tok`);
    }

    return segments.join(" · ");
  }

  if (activeSubagents > 0) {
    segments.push(`Mesh ×${activeSubagents} working`);
    if (toolCalls > 0) {
      segments.push(`${toolCalls} ${toolCalls === 1 ? "tool" : "tools"}`);
    }
    if (estimatedTokensUsed > 0) {
      segments.push(`${formatCompactTokenCount(estimatedTokensUsed)} tok`);
    } else if (budgetPct !== null && budgetPct > 0) {
      segments.push(`${budgetPct}% budget`);
    }

    return segments.join(" · ");
  }

  if (isStreaming) {
    segments.push(tier === "intense" ? "High load" : "Streaming");
    if (toolCalls > 0) {
      segments.push(`${toolCalls} ${toolCalls === 1 ? "tool" : "tools"}`);
    }
    if (estimatedTokensUsed > 0) {
      segments.push(`${formatCompactTokenCount(estimatedTokensUsed)} tok`);
    } else if (budgetPct !== null) {
      segments.push(`${budgetPct}% budget`);
    }

    return segments.join(" · ");
  }

  if (completedSubagents > 0) {
    segments.push(`Mesh ×${completedSubagents} complete`);
  } else {
    segments.push("Idle");
  }

  if (budgetPct !== null) {
    segments.push(`${budgetPct}% budget`);
  } else if (toolCalls > 0) {
    segments.push(`${toolCalls} ${toolCalls === 1 ? "tool" : "tools"}`);
  } else if (estimatedTokensUsed > 0) {
    segments.push(`${formatCompactTokenCount(estimatedTokensUsed)} tok`);
  }

  return segments.join(" · ");
}

/**
 * Computes a deterministic, smooth telemetry & visual intensity state from live LLM activity
 * and user usage limits.
 */
export function computeLlmProcessingIntensity(
  input: LlmProcessingTelemetryInput = {}
): LlmProcessingIntensitySnapshot {
  const isStreaming = Boolean(input.isStreaming);
  const activeSubagents = Math.floor(safeNonNegative(input.activeSubagentCount));
  const completedSubagents = Math.floor(safeNonNegative(input.completedSubagentCount));
  const toolCalls = Math.floor(safeNonNegative(input.toolCallCount));
  const estimatedTokensUsed = safeNonNegative(input.estimatedTokensUsed);
  const tokenSoftCap =
    typeof input.tokenSoftCap === "number" &&
    Number.isFinite(input.tokenSoftCap) &&
    input.tokenSoftCap > 0
      ? input.tokenSoftCap
      : DEFAULT_TOKEN_SOFT_CAP;
  const zeroDataRetention = Boolean(input.zeroDataRetention);

  const tokenThroughputRatio = clamp(estimatedTokensUsed / tokenSoftCap, 0, 1);

  const hasPlanLimit =
    typeof input.planLimitUsd === "number" &&
    Number.isFinite(input.planLimitUsd) &&
    input.planLimitUsd > 0 &&
    typeof input.planSpentUsd === "number" &&
    Number.isFinite(input.planSpentUsd);
  const planSpent = hasPlanLimit ? safeNonNegative(input.planSpentUsd) : null;
  const planLimit = hasPlanLimit ? (input.planLimitUsd as number) : null;
  const planRatio =
    planSpent !== null && planLimit !== null ? clamp(planSpent / planLimit, 0, 1) : null;

  const hasTurnLimit =
    typeof input.turnHardLimitUsd === "number" &&
    Number.isFinite(input.turnHardLimitUsd) &&
    input.turnHardLimitUsd > 0 &&
    typeof input.turnSpentUsd === "number" &&
    Number.isFinite(input.turnSpentUsd);
  const turnSpent = hasTurnLimit ? safeNonNegative(input.turnSpentUsd) : null;
  const turnLimit = hasTurnLimit ? (input.turnHardLimitUsd as number) : null;
  const turnRatio =
    turnSpent !== null && turnLimit !== null ? clamp(turnSpent / turnLimit, 0, 1) : null;

  const budgetUtilizationRatio =
    planRatio !== null && turnRatio !== null
      ? roundTo(Math.max(planRatio, turnRatio), 4)
      : planRatio !== null
        ? roundTo(planRatio, 4)
        : turnRatio !== null
          ? roundTo(turnRatio, 4)
          : null;

  const budgetRemainingUsd =
    planSpent !== null && planLimit !== null
      ? roundTo(Math.max(0, planLimit - planSpent), 4)
      : turnSpent !== null && turnLimit !== null
        ? roundTo(Math.max(0, turnLimit - turnSpent), 4)
        : null;

  const isWorking = isStreaming || activeSubagents > 0;
  const isNearBudgetLimit =
    budgetUtilizationRatio !== null && budgetUtilizationRatio >= BUDGET_NEAR_LIMIT_RATIO;
  const isBudgetExhausted = budgetUtilizationRatio !== null && budgetUtilizationRatio >= 1;

  // Compute load combines active streaming, parallel subagent workers, and tool invocations.
  const streamComponent = isStreaming ? 0.26 : activeSubagents > 0 ? 0.22 : 0;
  const subagentComponent = clamp(activeSubagents / 3, 0, 1) * 0.44;
  const toolComponent = clamp(toolCalls / 6, 0, 1) * 0.14;
  const activeComputeLoad = isWorking
    ? clamp(streamComponent + subagentComponent + toolComponent, 0, 0.84)
    : 0;

  const tokenComponent = tokenThroughputRatio * (isWorking ? 0.26 : 0.1);
  const budgetComponent = (budgetUtilizationRatio ?? 0) * (isWorking ? 0.18 : 0.14);
  const completedComponent =
    !isWorking && completedSubagents > 0 ? clamp(completedSubagents * 0.02, 0, 0.06) : 0;

  let rawIntensity = activeComputeLoad + tokenComponent + budgetComponent + completedComponent;

  if (isNearBudgetLimit && budgetUtilizationRatio !== null) {
    const budgetFloor =
      0.76 +
      ((budgetUtilizationRatio - BUDGET_NEAR_LIMIT_RATIO) / (1 - BUDGET_NEAR_LIMIT_RATIO)) * 0.24;

    rawIntensity = Math.max(rawIntensity, budgetFloor);
  }

  const intensity = roundTo(clamp(rawIntensity, 0, 1), 3);
  const tier = resolveIntensityTierFromScore(intensity, {
    budgetUtilizationRatio,
    isWorking,
  });

  const markState: OrganicActivityState = isBudgetExhausted
    ? "blocked"
    : isWorking
      ? "working"
      : completedSubagents > 0
        ? "complete"
        : "idle";

  const motionScale = roundTo(
    clamp(
      MOTION_SCALE_MIN + intensity * (MOTION_SCALE_MAX - MOTION_SCALE_MIN),
      MOTION_SCALE_MIN,
      MOTION_SCALE_MAX
    ),
    3
  );

  const label = buildIntensityLabel({
    tier,
    isStreaming,
    activeSubagents,
    completedSubagents,
    toolCalls,
    estimatedTokensUsed,
    budgetUtilizationRatio,
    zeroDataRetention,
  });

  return {
    intensity,
    tier,
    markState,
    motionScale,
    budgetUtilizationRatio,
    budgetRemainingUsd,
    label,
  };
}

/**
 * Estimates tool call count and token throughput from UI messages and subagent snapshots.
 */
export function deriveSessionTelemetryCounts(args: {
  messages: ReadonlyArray<UIMessage>;
  subagents?: ReadonlyArray<{
    status?: string | null;
    goal?: string | null;
    outcome?: string | null;
    progress?: string | null;
  }>;
}): {
  toolCallCount: number;
  estimatedTokensUsed: number;
  activeSubagentCount: number;
  completedSubagentCount: number;
} {
  let toolCallCount = 0;
  let totalChars = 0;

  for (const message of args.messages) {
    for (const part of message.parts ?? []) {
      if (part.type === "text" && typeof part.text === "string") {
        totalChars += part.text.length;
      } else if (isToolUIPart(part)) {
        toolCallCount += 1;
        try {
          if (part.input !== undefined) {
            totalChars += JSON.stringify(part.input).length;
          }
          if ("output" in part && part.output !== undefined) {
            totalChars += JSON.stringify(part.output).length;
          }
        } catch {
          totalChars += 120;
        }
      }
    }
  }

  let activeSubagentCount = 0;
  let completedSubagentCount = 0;

  for (const worker of args.subagents ?? []) {
    const status = worker.status ?? "idle";

    if (status === "working" || status === "queued") {
      activeSubagentCount += 1;
    } else if (status === "done" || status === "complete") {
      completedSubagentCount += 1;
    }

    if (typeof worker.goal === "string") totalChars += worker.goal.length;
    if (typeof worker.outcome === "string") totalChars += worker.outcome.length;
    else if (typeof worker.progress === "string") totalChars += worker.progress.length;
  }

  // Approximate ~4 characters per token, plus fixed overhead per tool invocation and active worker.
  const estimatedTokensUsed =
    totalChars > 0 || toolCallCount > 0 || activeSubagentCount > 0
      ? Math.round(totalChars / 4) + toolCallCount * 180 + activeSubagentCount * 450
      : 0;

  return {
    toolCallCount,
    estimatedTokensUsed,
    activeSubagentCount,
    completedSubagentCount,
  };
}
