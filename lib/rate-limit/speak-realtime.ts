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
  /** Server clock (ms) through which usage has already been billed. */
  lastMeteredAt: number;
  /** Server clock (ms) past which no further usage is billable; the session is settled instead. */
  expiresAt: number;
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

  if (!raw) return null;

  // Records written before server-side metering lack the clock fields.
  return {
    ...raw,
    lastMeteredAt: raw.lastMeteredAt ?? raw.startedAt,
    expiresAt: raw.expiresAt ?? raw.startedAt + getSpeakSessionMaxMinutes() * 60_000,
  };
}

async function saveSpeakRealtimeSession(record: SpeakRealtimeSessionRecord): Promise<void> {
  await redis.set(sessionKey(record.sessionId), record, { ex: SESSION_TTL_SECONDS });
}

async function closeSpeakRealtimeSession(record: SpeakRealtimeSessionRecord): Promise<void> {
  record.status = "closed";
  await saveSpeakRealtimeSession(record);
  await redis.srem(activeSetKey(record.userId), record.sessionId);
}

/** Wall-clock minutes owed for a session, measured on the server and capped at its deadline. */
function unmeteredMinutes(session: SpeakRealtimeSessionRecord, now: number): number {
  const billableUntil = Math.min(now, session.expiresAt);

  return Math.max(0, (billableUntil - session.lastMeteredAt) / 60_000);
}

function incrementalCostUsd(
  session: SpeakRealtimeSessionRecord,
  minutesDelta: number,
  usage?: Usage
): number {
  const modelId = normalizeRealtimeModelId(session.model);

  if (usage) return computeUsageCostUsd(modelId, usage);
  if (minutesDelta > 0) return estimateRealtimeMinuteCostUsd(modelId) * minutesDelta;

  return 0;
}

/**
 * Bills elapsed minutes and token usage against the daily/monthly limiters and the usage
 * ledger, advancing the session's meter. Enforces no caps — callers decide whether to close.
 */
async function recordSpeakUsage(args: {
  session: SpeakRealtimeSessionRecord;
  minutesDelta: number;
  usage?: Usage;
  now: number;
}): Promise<void> {
  const { session, usage, now } = args;
  const minutesDelta = Math.max(0, args.minutesDelta);
  const modelId = normalizeRealtimeModelId(session.model);
  const incrementalCost = incrementalCostUsd(session, minutesDelta, usage);

  if (minutesDelta > 0) {
    const minuteUnits = Math.max(1, Math.ceil(minutesDelta));

    await runLimiter("recordSpeakDailyMinutes", () =>
      dailyMinuteLimiter.limit(session.userId, { rate: minuteUnits })
    );
  }

  if (incrementalCost > 0) {
    const costUnits = Math.max(1, Math.ceil(incrementalCost * COST_UNITS_PER_USD));

    await runLimiter("recordSpeakMonthlyCost", () =>
      monthlyCostLimiter.limit(session.userId, { rate: costUnits })
    );

    await recordLlmCost(session.userId, modelId, {
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      cachedInputTokens: usage?.cachedInputTokens ?? 0,
      audioInputTokens: usage?.audioInputTokens,
      audioOutputTokens: usage?.audioOutputTokens,
    });

    const totalTokens =
      (usage?.inputTokens ?? 0) +
      (usage?.outputTokens ?? 0) +
      (usage?.audioInputTokens ?? 0) +
      (usage?.audioOutputTokens ?? 0);

    trackLlmUsageEvent({
      ownerId: session.userId,
      modelId,
      inputTokens: (usage?.inputTokens ?? 0) + Math.ceil((usage?.audioInputTokens ?? 0) / 2),
      outputTokens: (usage?.outputTokens ?? 0) + Math.ceil((usage?.audioOutputTokens ?? 0) / 2),
      cachedInputTokens: usage?.cachedInputTokens ?? 0,
      totalTokens: Math.max(1, totalTokens || Math.ceil(incrementalCost * 1000)),
      operation: "speak-realtime",
      route: "/api/ai/speak/realtime",
    });
  }

  session.minutesUsed += minutesDelta;
  session.costUsd += incrementalCost;
  session.lastMeteredAt = Math.min(now, session.expiresAt);
}

/**
 * Settles sessions a client abandoned without calling `/end`: bills wall-clock time up to the
 * session deadline and frees the concurrency slot. Sessions still inside their window are left
 * alone, so an abandoned session keeps blocking new ones until it is paid for.
 */
export async function settleStaleSpeakSessions(userId: string): Promise<void> {
  const sessionIds = await redis.smembers(activeSetKey(userId));

  if (sessionIds.length === 0) return;

  const now = Date.now();

  for (const sessionId of sessionIds) {
    const session = await getSpeakRealtimeSession(sessionId);

    if (!session || session.userId !== userId) {
      await redis.srem(activeSetKey(userId), sessionId);
      continue;
    }

    if (session.status === "active" && now < session.expiresAt) continue;

    await recordSpeakUsage({
      session,
      minutesDelta: unmeteredMinutes(session, now),
      now,
    });
    await closeSpeakRealtimeSession(session);

    logger.log("settleStaleSpeakSessions", `Settled abandoned session ${sessionId}`, {
      minutesUsed: session.minutesUsed,
      costUsd: session.costUsd,
    });
  }
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

  // Charge for any abandoned session before its slot and budget are reused.
  await settleStaleSpeakSessions(userId);

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
  const startedAt = Date.now();
  const record: SpeakRealtimeSessionRecord = {
    sessionId: args.sessionId,
    userId: args.userId,
    model: args.model,
    threadId: args.threadId,
    modalities: args.modalities,
    startedAt,
    lastMeteredAt: startedAt,
    expiresAt: startedAt + getSpeakSessionMaxMinutes() * 60_000,
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
 * Heartbeat / mid-session guard. Elapsed time is measured from the server clock, so a client
 * cannot under-report it. Bills whatever is owed, then forces close when a cap is hit.
 */
export async function assertSpeakBudgetOrClose(args: {
  sessionId: string;
  userId: string;
  usage?: Usage;
}): Promise<SpeakBudgetAssertResult> {
  const session = await getSpeakRealtimeSession(args.sessionId);

  if (!session || session.userId !== args.userId) {
    return { ok: false, shouldClose: true, error: "Session not found" };
  }

  if (session.status !== "active") {
    return { ok: false, shouldClose: true, error: "Session already closed", session };
  }

  const now = Date.now();
  const sessionMax = getSpeakSessionMaxMinutes();

  await recordSpeakUsage({
    session,
    minutesDelta: unmeteredMinutes(session, now),
    usage: args.usage,
    now,
  });
  await saveSpeakRealtimeSession(session);

  if (now >= session.expiresAt || session.minutesUsed > sessionMax + 0.05) {
    await closeSpeakRealtimeSession(session);

    return {
      ok: false,
      shouldClose: true,
      error: `Session minute limit (${sessionMax} min) exceeded`,
      session,
    };
  }

  const budget = await getSpeakBudgetSnapshot(args.userId);

  if (budget.dailyMinutesRemaining < 1) {
    await closeSpeakRealtimeSession(session);

    return {
      ok: false,
      shouldClose: true,
      error: "Daily Speak Realtime minute limit exceeded",
      session,
      budget,
    };
  }

  if (budget.monthlyCostRemainingUsd <= 0.001) {
    await closeSpeakRealtimeSession(session);

    return {
      ok: false,
      shouldClose: true,
      error: `Monthly Speak Realtime spend cap ($${getSpeakMonthlyCostCapUsd().toFixed(0)}) exceeded`,
      session,
      budget,
    };
  }

  return { ok: true, shouldClose: false, session, budget };
}

export async function endSpeakRealtimeSession(args: {
  sessionId: string;
  userId: string;
  usage?: Usage;
}): Promise<SpeakRealtimeSessionRecord | null> {
  const session = await getSpeakRealtimeSession(args.sessionId);

  if (!session || session.userId !== args.userId) {
    return null;
  }

  if (session.status === "active") {
    const now = Date.now();

    // Bill the tail between the last heartbeat and disconnect.
    await recordSpeakUsage({
      session,
      minutesDelta: unmeteredMinutes(session, now),
      usage: args.usage,
      now,
    });
  }

  await closeSpeakRealtimeSession(session);
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
