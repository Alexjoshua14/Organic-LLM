import type { ChatModel } from "@/lib/schemas/chat-models";

import { computeUsageCostUsd, getModelCost } from "@/lib/rate-limit/llm-cost";
import { ORCHESTRATOR_MAX_PARALLEL_DISPATCHES_PER_TURN } from "@/lib/llm/subagents/orchestrator/constants";
import { models } from "@/lib/schemas/chat-models";

export const SUBAGENT_MODEL_TIERS = ["micro", "economy", "standard", "frontier"] as const;

export type SubagentModelTier = (typeof SUBAGENT_MODEL_TIERS)[number];

/** Default per-turn hard USD ceiling when no explicit override is provided. */
export const SUBAGENT_DEFAULT_TURN_HARD_LIMIT_USD = 0.5;

/** Default expected output tokens per worker run when estimating preflight USD cost. */
export const SUBAGENT_DEFAULT_ESTIMATED_OUTPUT_TOKENS = 1_000;

export function getSubagentTierModel(tier: SubagentModelTier): ChatModel {
  switch (tier) {
    case "micro":
      return models.google.flashLite;
    case "economy":
      return models.anthropic.haiku;
    case "standard":
      return models.anthropic.sonnet;
    case "frontier":
      return models.anthropic.opus;
  }
}

/** Worker models are selected separately from the user's orchestrator model. */
export function selectSubagentModel(args: {
  tier?: SubagentModelTier;
  reason?: string;
  zeroDataRetention: boolean;
}): { ok: true; modelId: string; tier: SubagentModelTier } | { ok: false; error: string } {
  const tier = args.tier ?? "economy";

  if ((tier === "standard" || tier === "frontier") && (args.reason?.trim().length ?? 0) < 20) {
    return {
      ok: false,
      error:
        tier === "frontier"
          ? "A frontier worker needs a specific reason why economy and standard models are insufficient (at least 20 characters)."
          : "A standard worker needs a specific reason why the economy model is insufficient (at least 20 characters).",
    };
  }

  const model = getSubagentTierModel(tier);

  if (args.zeroDataRetention && model.supportsZeroDataRetention !== true) {
    return {
      ok: false,
      error: "The worker model does not support the required zero data retention setting.",
    };
  }

  return { ok: true, modelId: model.id, tier };
}

/**
 * Estimate USD cost for a worker run given `(tier | modelId, estimatedInputTokens, maxOutputTokens)`.
 */
export function estimateCallCostUsd(args: {
  tier?: SubagentModelTier;
  modelId?: string;
  estimatedInputTokens: number;
  maxOutputTokens?: number;
  cachedInputTokens?: number;
}): number {
  const modelId = args.modelId ?? getSubagentTierModel(args.tier ?? "economy").id;
  const inputTokens = Math.max(0, args.estimatedInputTokens);
  const outputTokens = Math.max(
    0,
    args.maxOutputTokens ?? SUBAGENT_DEFAULT_ESTIMATED_OUTPUT_TOKENS
  );

  return computeUsageCostUsd(modelId, {
    inputTokens,
    outputTokens,
    cachedInputTokens: args.cachedInputTokens ?? 0,
  });
}

export const estimateWorkerCallCostUsd = estimateCallCostUsd;

export type SubagentPlanBudgetInput = {
  /** Spent USD in the current billing window (`spentUsd` or `usedUsd` from PlanBudgetSnapshot). */
  spentUsd?: number;
  usedUsd?: number;
  /** Cap USD in the current billing window (`limitUsd` or `capUsd`; null when uncapped). */
  limitUsd?: number | null;
  capUsd?: number | null;
  remainingUsd?: number | null;
  canDispatch?: boolean;
  plan?: string;
  holdReason?: string | null;
};

export type SubagentBudgetSnapshot = {
  turnSpentEstimatedUsd: number;
  turnDispatches: number;
  maxParallelDispatches: number;
  hardLimitUsd: number;
  remainingUsd: number;
  planSpentUsd: number | null;
  planLimitUsd: number | null;
  planRemainingUsd: number | null;
  canDispatch: boolean;
  zeroDataRetention: boolean;
};

export type SubagentBudgetState = SubagentBudgetSnapshot;

export type SubagentBudgetCheckResult =
  | {
      ok: true;
      estimatedCostUsd: number;
      turnEstimatedSpendUsd: number;
      projectedTurnSpendUsd: number;
      hardLimitUsd: number;
      remainingUsd: number;
      zeroDataRetention: boolean;
    }
  | {
      ok: false;
      estimatedCostUsd: number;
      turnEstimatedSpendUsd: number;
      projectedTurnSpendUsd: number;
      hardLimitUsd: number;
      remainingUsd: number;
      suggestedTier: SubagentModelTier | null;
      zeroDataRetention: boolean;
      error: string;
    };

export type SubagentBudgetPolicy = {
  maxParallelDispatches: number;
  hardLimitUsd: number;
  snapshot(): SubagentBudgetSnapshot;
  checkDispatch(args: {
    tier: SubagentModelTier;
    modelId?: string;
    estimatedInputTokens: number;
    maxOutputTokens?: number;
  }): SubagentBudgetCheckResult;
  recordDispatch(estimatedCostUsd: number): SubagentBudgetSnapshot;
};

export type SubagentBudgetLedger = SubagentBudgetPolicy;

function normalizePlanBudget(planBudget?: SubagentPlanBudgetInput | null): {
  spentUsd: number | null;
  limitUsd: number | null;
  remainingUsd: number | null;
  canDispatch: boolean;
  holdReason: string | null;
} {
  if (!planBudget) {
    return {
      spentUsd: null,
      limitUsd: null,
      remainingUsd: null,
      canDispatch: true,
      holdReason: null,
    };
  }
  const spent = planBudget.spentUsd ?? planBudget.usedUsd ?? 0;
  const limit =
    planBudget.limitUsd !== undefined
      ? planBudget.limitUsd
      : planBudget.capUsd !== undefined
        ? planBudget.capUsd
        : null;
  const remaining =
    planBudget.remainingUsd !== undefined && planBudget.remainingUsd !== null
      ? Math.max(0, planBudget.remainingUsd)
      : limit !== null
        ? Math.max(0, limit - spent)
        : null;
  const canDispatch =
    planBudget.canDispatch !== undefined
      ? planBudget.canDispatch
      : remaining === null || remaining > 0;

  return {
    spentUsd: spent,
    limitUsd: limit,
    remainingUsd: remaining,
    canDispatch,
    holdReason: planBudget.holdReason ?? null,
  };
}

function suggestCheaperTier(args: {
  currentTier: SubagentModelTier;
  estimatedInputTokens: number;
  maxOutputTokens?: number;
  remainingUsd: number;
}): SubagentModelTier | null {
  const order: SubagentModelTier[] = ["micro", "economy", "standard", "frontier"];
  const idx = order.indexOf(args.currentTier);

  for (let i = idx - 1; i >= 0; i -= 1) {
    const candidate = order[i]!;
    const cost = estimateCallCostUsd({
      tier: candidate,
      estimatedInputTokens: args.estimatedInputTokens,
      maxOutputTokens: args.maxOutputTokens,
    });

    if (cost <= args.remainingUsd) return candidate;
  }

  return idx > 0 ? "micro" : null;
}

export function createSubagentBudgetPolicy(options?: {
  planBudget?: SubagentPlanBudgetInput | null;
  hardLimitUsd?: number;
  maxParallelDispatches?: number;
  zeroDataRetention?: boolean;
}): SubagentBudgetPolicy {
  const normalizedPlan = normalizePlanBudget(options?.planBudget);
  const requestedTurnLimit = Math.max(
    0,
    options?.hardLimitUsd ?? SUBAGENT_DEFAULT_TURN_HARD_LIMIT_USD
  );
  const effectiveHardLimitUsd = !normalizedPlan.canDispatch
    ? 0
    : normalizedPlan.remainingUsd !== null
      ? Math.min(requestedTurnLimit, normalizedPlan.remainingUsd)
      : requestedTurnLimit;
  const maxParallelDispatches =
    options?.maxParallelDispatches ?? ORCHESTRATOR_MAX_PARALLEL_DISPATCHES_PER_TURN;
  const zeroDataRetention = options?.zeroDataRetention ?? false;

  let turnSpentEstimatedUsd = 0;
  let turnDispatches = 0;

  const snapshot = (): SubagentBudgetSnapshot => {
    const remainingUsd = Math.max(0, effectiveHardLimitUsd - turnSpentEstimatedUsd);

    return {
      turnSpentEstimatedUsd,
      turnDispatches,
      maxParallelDispatches,
      hardLimitUsd: effectiveHardLimitUsd,
      remainingUsd,
      planSpentUsd: normalizedPlan.spentUsd,
      planLimitUsd: normalizedPlan.limitUsd,
      planRemainingUsd:
        normalizedPlan.remainingUsd !== null
          ? Math.max(0, normalizedPlan.remainingUsd - turnSpentEstimatedUsd)
          : null,
      canDispatch: normalizedPlan.canDispatch && remainingUsd > 0,
      zeroDataRetention,
    };
  };

  return {
    maxParallelDispatches,
    hardLimitUsd: effectiveHardLimitUsd,
    snapshot,
    checkDispatch: ({ tier, modelId, estimatedInputTokens, maxOutputTokens }) => {
      const estimatedCostUsd = estimateCallCostUsd({
        tier,
        modelId,
        estimatedInputTokens,
        maxOutputTokens,
      });
      const projectedTurnSpendUsd = turnSpentEstimatedUsd + estimatedCostUsd;
      const remainingBefore = Math.max(0, effectiveHardLimitUsd - turnSpentEstimatedUsd);

      if (!normalizedPlan.canDispatch) {
        return {
          ok: false,
          estimatedCostUsd,
          turnEstimatedSpendUsd: turnSpentEstimatedUsd,
          projectedTurnSpendUsd,
          hardLimitUsd: effectiveHardLimitUsd,
          remainingUsd: 0,
          suggestedTier: null,
          zeroDataRetention,
          error:
            normalizedPlan.holdReason ??
            "Plan budget is exhausted or unavailable; subagent dispatch is blocked until the budget window resets.",
        };
      }

      if (projectedTurnSpendUsd > effectiveHardLimitUsd) {
        const suggestedTier = suggestCheaperTier({
          currentTier: tier,
          estimatedInputTokens,
          maxOutputTokens,
          remainingUsd: remainingBefore,
        });
        const downshiftHint = suggestedTier
          ? `Downshift modelTier to "${suggestedTier}" or trim context bundles.`
          : 'Trim context bundles, use history="fresh", or handle the remaining synthesis inline.';

        return {
          ok: false,
          estimatedCostUsd,
          turnEstimatedSpendUsd: turnSpentEstimatedUsd,
          projectedTurnSpendUsd,
          hardLimitUsd: effectiveHardLimitUsd,
          remainingUsd: remainingBefore,
          suggestedTier,
          zeroDataRetention,
          error: `Estimated worker cost ($${estimatedCostUsd.toFixed(4)} on ${tier}) would push turn spend to $${projectedTurnSpendUsd.toFixed(4)}, exceeding the $${effectiveHardLimitUsd.toFixed(4)} hard budget limit ($${remainingBefore.toFixed(4)} remaining). ${downshiftHint}`,
        };
      }

      return {
        ok: true,
        estimatedCostUsd,
        turnEstimatedSpendUsd: turnSpentEstimatedUsd,
        projectedTurnSpendUsd,
        hardLimitUsd: effectiveHardLimitUsd,
        remainingUsd: Math.max(0, effectiveHardLimitUsd - projectedTurnSpendUsd),
        zeroDataRetention,
      };
    },
    recordDispatch: (estimatedCostUsd: number) => {
      turnSpentEstimatedUsd += Math.max(0, estimatedCostUsd);
      turnDispatches += 1;

      return snapshot();
    },
  };
}

export const createSubagentBudgetLedger = createSubagentBudgetPolicy;

function formatTierCostSummary(): string {
  return SUBAGENT_MODEL_TIERS.map((tier) => {
    const model = getSubagentTierModel(tier);
    const cost = getModelCost(model.id);

    return `${tier}=${model.name} ($${cost.inputPerMillion}/$${cost.outputPerMillion} per 1M in/out)`;
  }).join("; ");
}

export function formatSubagentCostPolicy(
  budget?: SubagentBudgetSnapshot | SubagentPlanBudgetInput | null
): string {
  const lines = [
    "- Budget first: answer in this thread when your existing context and tools can produce the requested result. Routine drafting, summarizing, planning, explanations and small edits do not need a specialist.",
    "- Delegate only when the user explicitly asks for a specialist, its tools or expertise are needed, or a distinct substantial deliverable benefits from isolation. Prefer the smallest suitable specialist; do not split one task across several agents merely because their roles overlap.",
    "- Start with one specialist. A second dispatch requires additionalDispatchReason explaining the independent work it adds. Do not start unsolicited review, judging, polishing or redundant research cycles.",
    `- Workers use ${models.anthropic.haiku.name} by default (modelTier=economy), independently of your model. Use modelTier=micro (${models.google.flashLite.name}) for fast triage/formatting, modelTier=standard (${models.anthropic.sonnet.name}) for demanding implementation, architecture or complex evidence synthesis, or modelTier=frontier (${models.anthropic.opus.name}) only when the hardest multi-invariant reasoning is needed and budget allows. Both standard and frontier require modelReason (>=20 chars). A long brief or a prestigious role alone does not justify an upgrade.`,
    `- Tier pricing: ${formatTierCostSummary()}.`,
    "- Reuse relevant completed results and saved evidence. Check the status summary before dispatch: wait for a working specialist instead of queueing more work for it, and never repeat an assignment just to get an update.",
    "- Give the specialist a bounded deliverable and the minimum sufficient context. Stop once the user's requested result is covered; report missing inputs or unfinished work instead of silently starting another cycle.",
  ];

  if (budget) {
    const snap =
      "turnSpentEstimatedUsd" in budget
        ? budget
        : createSubagentBudgetPolicy({ planBudget: budget }).snapshot();
    const planPart =
      snap.planLimitUsd !== null && snap.planRemainingUsd !== null
        ? `plan remaining $${snap.planRemainingUsd.toFixed(2)} of $${snap.planLimitUsd.toFixed(2)} ($${(snap.planSpentUsd ?? 0).toFixed(2)} used)`
        : snap.planSpentUsd !== null
          ? `plan uncapped ($${snap.planSpentUsd.toFixed(2)} used this cycle)`
          : "plan allowance active";

    lines.push(
      `- Self-managed budget ledger: turn hard limit $${snap.hardLimitUsd.toFixed(4)} ($${snap.remainingUsd.toFixed(4)} remaining this turn), max ${snap.maxParallelDispatches} parallel dispatches/turn, ${planPart}, ZDR=${snap.zeroDataRetention ? "required" : "off"}. If a dispatch exceeds remaining USD, downshift modelTier to economy/micro or trim context bundles.`
    );
  }

  return lines.join("\n");
}
