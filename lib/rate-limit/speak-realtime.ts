import "server-only";

import type { RateLimitResult } from "@/lib/rate-limit/llm";
import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";

import { Duration, Ratelimit } from "@upstash/ratelimit";

import { fetchLlmUsageEvents } from "@/data/supabase/llm-usage";
import { createLogger } from "@/lib/logger";
import {
  computeCost,
  computeUsageCostUsd,
  costUnitsFromUsd,
  estimateRealtimeMinuteCostUsd,
  normalizeRealtimeModelId,
  type Usage,
} from "@/lib/rate-limit/llm-cost";
import { checkLlmCostLimit, recordLlmCost } from "@/lib/rate-limit/llm";
import { runLimiter } from "@/lib/rate-limit/run-limiter";
import { redis } from "@/lib/redis/redis";
import { startOfBillingCycle } from "@/lib/usage/aggregate";
import { trackLlmUsageEvent } from "@/lib/usage/track-llm-usage";

export type { SpeakBudgetSnapshot } from "@/lib/speak/types";

const logger = createLogger("lib/rate-limit/speak-realtime.ts");

const COST_UNITS_PER_USD = 10_000;

export function isSpeakRealtimeEnabled(): boolean {
  return process.env.SPEAK_REALTIME_ENABLED !== "false";
}

export function getSpeakRealtimeModel(): string {
  return process.env.SPEAK_REALTIME_MODEL?.trim() || "gpt-realtime-mini";
}

export function getSpeakMonthlyCostCapUsd(): number {
  return Math.max(0.01, parseFloat(process.env.SPEAK_MONTHLY_COST_CAP_USD ?? "20"));
}

export function getSpeakDailyMinutesCap(): number {
  return Math.max(1, parseInt(process.env.SPEAK_DAILY_MINUTES_CAP ?? "30", 10));
}

export function getSpeakSessionMaxMinutes(): number {
  return Math.max(1, parseInt(process.env.SPEAK_SESSION_MAX_MINUTES ?? "8", 10));
}

export function getSpeakConcurrentSessions(): number {
  return Math.max(1, parseInt(process.env.SPEAK_CONCURRENT_SESSIONS ?? "1", 10));
}

const DAILY_MINUTES = getSpeakDailyMinutesCap();
const dailyMinuteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAILY_MINUTES, "1 d" as Duration),
  prefix: "ratelimit:speak:realtime-minutes",
});

const MONTHLY_COST_UNITS = Math.ceil(getSpeakMonthlyCostCapUsd() * COST_UNITS_PER_USD);
const monthlyCostLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MONTHLY_COST_UNITS, "30 d" as Duration),
  prefix: "ratelimit:speak:realtime-cost",
});

export type SpeakRealtimeSessionRecord = {
  sessionId: string;
  userId: string;
  model: string;
  threadId: string | null;
  modalities: SpeakModalities;
  startedAt: number;
  minutesUsed: number;
  costUsd: number;
  status: "active" | "closed";
};

function sessionKey(sessionId: string): string {
  return `speak:realtime:session:${sessionId}`;
}

function activeSetKey(userId: string): string {
  return `speak:realtime:active:${userId}`;
}

const SESSION_TTL_SECONDS = 60 * 60; // 1h hard TTL

export async function getSpeakRealtimeSession(
  sessionId: string
): Promise<SpeakRealtimeSessionRecord | null> {
  const raw = await redis.get<SpeakRealtimeSessionRecord>(sessionKey(sessionId));

  return raw ?? null;
}

async function saveSpeakRealtimeSession(record: SpeakRealtimeSessionRecord): Promise<void> {
  await redis.set(sessionKey(record.sessionId), record, { ex: SESSION_TTL_SECONDS });
}

async function sumSpeakMonthlyCostFromDb(userId: string): Promise<number> {
  const since = startOfBillingCycle();
  const events = await fetchLlmUsageEvents({ ownerId: userId, since });

  return events
    .filter((e) => e.operation === "speak-realtime" || e.route?.includes("/api/ai/speak/realtime"))
    .reduce((sum, e) => sum + (e.cost_usd ?? 0), 0);
}

export async function getSpeakBudgetSnapshot(userId: string): Promise<SpeakBudgetSnapshot> {
  const [{ remaining: dailyRemaining }, { remaining: costRemaining }, activeSessions, dbMonthly] =
    await Promise.all([
      runLimiter("speakDailyMinutesRemaining", () => dailyMinuteLimiter.getRemaining(userId)),
      runLimiter("speakMonthlyCostRemaining", () => monthlyCostLimiter.getRemaining(userId)),
      redis.scard(activeSetKey(userId)),
      sumSpeakMonthlyCostFromDb(userId),
    ]);

  const monthlyCap = getSpeakMonthlyCostCapUsd();
  const redisUsed = Math.max(0, (MONTHLY_COST_UNITS - costRemaining) / COST_UNITS_PER_USD);
  const monthlyUsed = Math.max(redisUsed, dbMonthly);

  return {
    monthlyCostCapUsd: monthlyCap,
    monthlyCostUsedUsd: monthlyUsed,
    monthlyCostRemainingUsd: Math.max(0, monthlyCap - monthlyUsed),
    dailyMinutesCap: DAILY_MINUTES,
    dailyMinutesRemaining: Math.max(0, dailyRemaining),
    sessionMaxMinutes: getSpeakSessionMaxMinutes(),
    concurrentSessions: getSpeakConcurrentSessions(),
    activeSessions,
  };
}

export async function checkSpeakRealtimeSessionStart(
  userId: string
): Promise<RateLimitResult & { budget?: SpeakBudgetSnapshot }> {
  if (!isSpeakRealtimeEnabled()) {
    return { success: false, error: "Speak Realtime is disabled" };
  }

  const budget = await getSpeakBudgetSnapshot(userId);

  if (budget.activeSessions >= budget.concurrentSessions) {
    return {
      success: false,
      error: "Another Speak Realtime session is already active",
      budget,
    };
  }

  if (budget.dailyMinutesRemaining < 1) {
    return {
      success: false,
      error: "Daily Speak Realtime minute limit exceeded",
      remaining: budget.dailyMinutesRemaining,
      budget,
    };
  }

  if (budget.monthlyCostRemainingUsd <= 0.001) {
    return {
      success: false,
      error: `Monthly Speak Realtime spend cap ($${budget.monthlyCostCapUsd.toFixed(0)}) exceeded`,
      budget,
    };
  }

  const globalCost = await checkLlmCostLimit(userId, Math.ceil(0.05 * COST_UNITS_PER_USD));

  if (!globalCost.success) {
    return { success: false, error: globalCost.error ?? "Cost limit exceeded", budget };
  }

  return { success: true, remaining: budget.dailyMinutesRemaining, budget };
}

export async function registerSpeakRealtimeSession(args: {
  sessionId: string;
  userId: string;
  model: string;
  threadId: string | null;
  modalities: SpeakModalities;
}): Promise<SpeakRealtimeSessionRecord> {
  const record: SpeakRealtimeSessionRecord = {
    sessionId: args.sessionId,
    userId: args.userId,
    model: args.model,
    threadId: args.threadId,
    modalities: args.modalities,
    startedAt: Date.now(),
    minutesUsed: 0,
    costUsd: 0,
    status: "active",
  };

  await saveSpeakRealtimeSession(record);
  await redis.sadd(activeSetKey(args.userId), args.sessionId);
  await redis.expire(activeSetKey(args.userId), SESSION_TTL_SECONDS);

  return record;
}

export type SpeakBudgetAssertResult = {
  ok: boolean;
  shouldClose: boolean;
  error?: string;
  session?: SpeakRealtimeSessionRecord;
  budget?: SpeakBudgetSnapshot;
};

/**
 * Heartbeat / mid-session guard. Increments minutes by `minutesDelta` (fractional OK).
 * Forces close when session/daily/monthly caps are hit.
 */
export async function assertSpeakBudgetOrClose(args: {
  sessionId: string;
  userId: string;
  minutesDelta?: number;
  usage?: Usage;
}): Promise<SpeakBudgetAssertResult> {
  const session = await getSpeakRealtimeSession(args.sessionId);

  if (!session || session.userId !== args.userId) {
    return { ok: false, shouldClose: true, error: "Session not found" };
  }

  if (session.status !== "active") {
    return { ok: false, shouldClose: true, error: "Session already closed", session };
  }

  const minutesDelta = Math.max(0, args.minutesDelta ?? 0);
  const modelId = normalizeRealtimeModelId(session.model);

  let incrementalCost = 0;

  if (args.usage) {
    incrementalCost = computeUsageCostUsd(modelId, args.usage);
  } else if (minutesDelta > 0) {
    incrementalCost = estimateRealtimeMinuteCostUsd(modelId) * minutesDelta;
  }

  const nextMinutes = session.minutesUsed + minutesDelta;
  const sessionMax = getSpeakSessionMaxMinutes();

  if (nextMinutes > sessionMax + 0.05) {
    session.status = "closed";
    await saveSpeakRealtimeSession(session);
    await redis.srem(activeSetKey(args.userId), args.sessionId);

    return {
      ok: false,
      shouldClose: true,
      error: `Session minute limit (${sessionMax} min) exceeded`,
      session,
    };
  }

  if (minutesDelta > 0) {
    const minuteUnits = Math.max(1, Math.ceil(minutesDelta));
    const { remaining } = await runLimiter("speakDailyMinutesRemaining", () =>
      dailyMinuteLimiter.getRemaining(args.userId)
    );

    if (remaining < minuteUnits) {
      session.status = "closed";
      await saveSpeakRealtimeSession(session);
      await redis.srem(activeSetKey(args.userId), args.sessionId);

      return {
        ok: false,
        shouldClose: true,
        error: "Daily Speak Realtime minute limit exceeded",
        session,
      };
    }

    await runLimiter("recordSpeakDailyMinutes", () =>
      dailyMinuteLimiter.limit(args.userId, { rate: minuteUnits })
    );
  }

  if (incrementalCost > 0) {
    const costUnits = Math.max(1, Math.ceil(incrementalCost * COST_UNITS_PER_USD));
    const { remaining } = await runLimiter("speakMonthlyCostRemaining", () =>
      monthlyCostLimiter.getRemaining(args.userId)
    );

    if (remaining < costUnits) {
      session.status = "closed";
      await saveSpeakRealtimeSession(session);
      await redis.srem(activeSetKey(args.userId), args.sessionId);

      return {
        ok: false,
        shouldClose: true,
        error: `Monthly Speak Realtime spend cap ($${getSpeakMonthlyCostCapUsd().toFixed(0)}) exceeded`,
        session,
      };
    }

    await runLimiter("recordSpeakMonthlyCost", () =>
      monthlyCostLimiter.limit(args.userId, { rate: costUnits })
    );

    await recordLlmCost(args.userId, modelId, {
      inputTokens: args.usage?.inputTokens ?? 0,
      outputTokens: args.usage?.outputTokens ?? 0,
      cachedInputTokens: args.usage?.cachedInputTokens ?? 0,
      audioInputTokens: args.usage?.audioInputTokens,
      audioOutputTokens: args.usage?.audioOutputTokens,
    });

    const totalTokens =
      (args.usage?.inputTokens ?? 0) +
      (args.usage?.outputTokens ?? 0) +
      (args.usage?.audioInputTokens ?? 0) +
      (args.usage?.audioOutputTokens ?? 0);

    if (totalTokens > 0 || incrementalCost > 0) {
      trackLlmUsageEvent({
        ownerId: args.userId,
        modelId,
        inputTokens:
          (args.usage?.inputTokens ?? 0) + Math.ceil((args.usage?.audioInputTokens ?? 0) / 2),
        outputTokens:
          (args.usage?.outputTokens ?? 0) + Math.ceil((args.usage?.audioOutputTokens ?? 0) / 2),
        cachedInputTokens: args.usage?.cachedInputTokens ?? 0,
        totalTokens: Math.max(1, totalTokens || Math.ceil(incrementalCost * 1000)),
        operation: "speak-realtime",
        route: "/api/ai/speak/realtime",
      });
    }
  }

  session.minutesUsed = nextMinutes;
  session.costUsd += incrementalCost;
  await saveSpeakRealtimeSession(session);

  const budget = await getSpeakBudgetSnapshot(args.userId);

  if (budget.monthlyCostRemainingUsd <= 0.001 || budget.dailyMinutesRemaining < 1) {
    session.status = "closed";
    await saveSpeakRealtimeSession(session);
    await redis.srem(activeSetKey(args.userId), args.sessionId);

    return {
      ok: false,
      shouldClose: true,
      error: "Speak Realtime budget exhausted",
      session,
      budget,
    };
  }

  return { ok: true, shouldClose: false, session, budget };
}

export async function endSpeakRealtimeSession(args: {
  sessionId: string;
  userId: string;
}): Promise<SpeakRealtimeSessionRecord | null> {
  const session = await getSpeakRealtimeSession(args.sessionId);

  if (!session || session.userId !== args.userId) {
    return null;
  }

  session.status = "closed";
  await saveSpeakRealtimeSession(session);
  await redis.srem(activeSetKey(args.userId), args.sessionId);
  logger.log("endSpeakRealtimeSession", `Closed ${args.sessionId}`, {
    minutesUsed: session.minutesUsed,
    costUsd: session.costUsd,
  });

  return session;
}

/** Exported for unit tests — cost unit helper. */
export function speakCostUnitsFromUsd(usd: number): number {
  return costUnitsFromUsd(usd);
}

export function speakComputeCostUnits(modelId: string, usage: Usage): number {
  return computeCost(normalizeRealtimeModelId(modelId), usage);
}
