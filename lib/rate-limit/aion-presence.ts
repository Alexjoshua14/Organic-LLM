import "server-only";

import type { AionPresenceBudgetSnapshot } from "@/lib/schemas/aion-presence";
import type { RateLimitResult } from "@/lib/rate-limit/llm";
import type { Usage } from "@/lib/rate-limit/llm-cost";

import { Duration, Ratelimit } from "@upstash/ratelimit";

import { fetchLlmUsageEvents } from "@/data/supabase/llm-usage";
import { createLogger } from "@/lib/logger";
import {
  AION_PRESENCE_DAILY_TURN_RATE_LIMIT,
  AION_PRESENCE_MINUTE_RATE_LIMIT,
} from "@/lib/rate-limit/catalog";
import { computeCost, computeUsageCostUsd, costUnitsFromUsd } from "@/lib/rate-limit/llm-cost";
import { checkLlmCostLimit, recordLlmCost } from "@/lib/rate-limit/llm";
import { runLimiter } from "@/lib/rate-limit/run-limiter";
import { redis } from "@/lib/redis/redis";
import { trackLlmUsageEvent } from "@/lib/usage/track-llm-usage";

const logger = createLogger("lib/rate-limit/aion-presence.ts");

const COST_UNITS_PER_USD = 10_000;

export function isAionPresenceEnabled(): boolean {
  return process.env.AION_PRESENCE_ENABLED !== "false";
}

export function getAionPresencePerMinuteCap(): number {
  return Math.max(1, AION_PRESENCE_MINUTE_RATE_LIMIT.cap);
}

export function getAionPresenceDailyTurnCap(): number {
  return Math.max(1, AION_PRESENCE_DAILY_TURN_RATE_LIMIT.cap);
}

export function getAionPresenceDailyCostCapUsd(): number {
  return Math.max(0.01, parseFloat(process.env.AION_PRESENCE_DAILY_COST_CAP_USD ?? "1"));
}

export function getAionPresenceMaxOutputTokens(): number {
  return Math.max(16, parseInt(process.env.AION_PRESENCE_MAX_OUTPUT_TOKENS ?? "120", 10));
}

const PER_MINUTE = getAionPresencePerMinuteCap();
const perMinuteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(PER_MINUTE, "1 m" as Duration),
  prefix: AION_PRESENCE_MINUTE_RATE_LIMIT.prefix,
});

const DAILY_TURNS = getAionPresenceDailyTurnCap();
const dailyTurnLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAILY_TURNS, "1 d" as Duration),
  prefix: AION_PRESENCE_DAILY_TURN_RATE_LIMIT.prefix,
});

const DAILY_COST_UNITS = Math.ceil(getAionPresenceDailyCostCapUsd() * COST_UNITS_PER_USD);
const dailyCostLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAILY_COST_UNITS, "1 d" as Duration),
  prefix: "ratelimit:aion:presence-daily-cost",
});

async function sumAionPresenceDailyCostFromDb(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await fetchLlmUsageEvents({ ownerId: userId, since });

  return events
    .filter((e) => e.operation === "aion-presence" || e.route?.includes("/api/ai/aion/event"))
    .reduce((sum, e) => sum + (e.cost_usd ?? 0), 0);
}

export async function getAionPresenceBudgetSnapshot(
  userId: string
): Promise<AionPresenceBudgetSnapshot> {
  const [
    { remaining: minuteRemaining },
    { remaining: turnRemaining },
    { remaining: costRemaining },
    dbDaily,
  ] = await Promise.all([
    runLimiter("aionPresenceMinuteRemaining", () => perMinuteLimiter.getRemaining(userId)),
    runLimiter("aionPresenceDailyTurnRemaining", () => dailyTurnLimiter.getRemaining(userId)),
    runLimiter("aionPresenceDailyCostRemaining", () => dailyCostLimiter.getRemaining(userId)),
    sumAionPresenceDailyCostFromDb(userId),
  ]);

  const dailyCostCap = getAionPresenceDailyCostCapUsd();
  const redisUsed = Math.max(0, (DAILY_COST_UNITS - costRemaining) / COST_UNITS_PER_USD);
  const dailyCostUsed = Math.max(redisUsed, dbDaily);
  const dailyTurnCap = getAionPresenceDailyTurnCap();

  return {
    dailyTurnCap,
    dailyTurnsRemaining: Math.max(0, turnRemaining),
    dailyTurnsUsed: Math.max(0, dailyTurnCap - turnRemaining),
    dailyCostCapUsd: dailyCostCap,
    dailyCostUsedUsd: dailyCostUsed,
    dailyCostRemainingUsd: Math.max(0, dailyCostCap - dailyCostUsed),
    perMinuteCap: getAionPresencePerMinuteCap(),
    perMinuteRemaining: Math.max(0, minuteRemaining),
    enabled: isAionPresenceEnabled(),
  };
}

export async function checkAionPresenceTurn(
  userId: string
): Promise<RateLimitResult & { budget?: AionPresenceBudgetSnapshot }> {
  if (!isAionPresenceEnabled()) {
    return { success: false, error: "Aion presence is disabled" };
  }

  const budget = await getAionPresenceBudgetSnapshot(userId);

  if (budget.perMinuteRemaining < 1) {
    return {
      success: false,
      error: AION_PRESENCE_MINUTE_RATE_LIMIT.error,
      remaining: budget.perMinuteRemaining,
      budget,
    };
  }

  if (budget.dailyTurnsRemaining < 1) {
    return {
      success: false,
      error: AION_PRESENCE_DAILY_TURN_RATE_LIMIT.error,
      remaining: budget.dailyTurnsRemaining,
      budget,
    };
  }

  if (budget.dailyCostRemainingUsd <= 0.0001) {
    return {
      success: false,
      error: `Daily Aion presence spend cap ($${budget.dailyCostCapUsd.toFixed(2)}) exceeded`,
      budget,
    };
  }

  const globalCost = await checkLlmCostLimit(userId, Math.ceil(0.01 * COST_UNITS_PER_USD));

  if (!globalCost.success) {
    return { success: false, error: globalCost.error ?? "Cost limit exceeded", budget };
  }

  return { success: true, remaining: budget.dailyTurnsRemaining, budget };
}

/**
 * Consumes one micro-turn from the per-minute and daily-turn buckets, then
 * records token cost against the daily USD bucket and the global ledger.
 */
export async function recordAionPresenceUsage(args: {
  userId: string;
  modelId: string;
  usage: Usage;
}): Promise<{ costUsd: number; budget: AionPresenceBudgetSnapshot }> {
  const { userId, modelId, usage } = args;

  await Promise.all([
    runLimiter("aionPresenceMinuteLimit", () => perMinuteLimiter.limit(userId)),
    runLimiter("aionPresenceDailyTurnLimit", () => dailyTurnLimiter.limit(userId)),
  ]);

  const costUsd = computeUsageCostUsd(modelId, usage);
  const costUnits = Math.max(1, costUnitsFromUsd(costUsd) || computeCost(modelId, usage));

  if (costUnits > 0) {
    await runLimiter("aionPresenceDailyCostLimit", () =>
      dailyCostLimiter.limit(userId, { rate: costUnits })
    );
  }

  trackLlmUsageEvent({
    ownerId: userId,
    modelId,
    inputTokens: usage.inputTokens ?? usage.promptTokens ?? 0,
    outputTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    totalTokens:
      (usage.inputTokens ?? usage.promptTokens ?? 0) +
      (usage.outputTokens ?? usage.completionTokens ?? 0),
    operation: "aion-presence",
    route: "/api/ai/aion/event",
  });

  try {
    await recordLlmCost(userId, modelId, usage);
  } catch (err) {
    logger.warn(
      "recordAionPresenceUsage",
      `recordLlmCost failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const budget = await getAionPresenceBudgetSnapshot(userId);

  return { costUsd, budget };
}
