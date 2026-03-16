import { Duration, Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { computeCost, type Usage } from "@/lib/rate-limit/llm-cost";

const MESSAGE_LIMIT = parseInt(process.env.LLM_RATE_LIMIT_MESSAGES ?? "60", 10);
const MESSAGE_WINDOW: Duration = (process.env.LLM_RATE_LIMIT_WINDOW as Duration) ?? "1 m";

const TOKEN_LIMIT = parseInt(process.env.LLM_RATE_LIMIT_TOKENS ?? "100000", 10);
const TOKEN_WINDOW: Duration = (process.env.LLM_RATE_LIMIT_TOKENS_WINDOW as Duration) ?? "1 h";

const COST_LIMIT_UNITS = parseInt(process.env.LLM_RATE_LIMIT_COST_UNITS ?? "10000", 10);
const COST_WINDOW: Duration = (process.env.LLM_RATE_LIMIT_COST_WINDOW as Duration) ?? "1 d";

/** Message-based: N requests per window per user (sliding). */
const messageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MESSAGE_LIMIT, MESSAGE_WINDOW),
  prefix: "ratelimit:llm:message",
});

/** Token-based: capacity in token units per window (optional). */
const tokenLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(TOKEN_LIMIT, TOKEN_WINDOW),
  prefix: "ratelimit:llm:token",
});

/** Cost-based: capacity in cost units per window (optional). */
const costLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(COST_LIMIT_UNITS, COST_WINDOW),
  prefix: "ratelimit:llm:cost",
});

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  error?: string;
};

function isTokenLimitEnabled(): boolean {
  return process.env.LLM_RATE_LIMIT_BY_TOKENS === "true";
}

function isCostLimitEnabled(): boolean {
  return process.env.LLM_RATE_LIMIT_BY_COST === "true";
}

/**
 * Check message-based rate limit. Call before each LLM request.
 * Uses Supabase user id as identifier (same as memory limits).
 */
export async function checkLlmMessageLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await messageLimiter.limit(userId);

  if (!success) {
    return { success: false, error: "Too many LLM requests" };
  }

  return { success: true, remaining };
}

/**
 * Check token-based limit using estimated tokens. Call before request when token limit is enabled.
 * Rejects if remaining capacity is less than estimatedTokens.
 */
export async function checkLlmTokenLimit(
  userId: string,
  estimatedTokens: number
): Promise<RateLimitResult> {
  if (!isTokenLimitEnabled()) {
    return { success: true };
  }
  const { remaining } = await tokenLimiter.getRemaining(userId);

  if (remaining < estimatedTokens) {
    return {
      success: false,
      error: "Token usage limit exceeded",
      remaining,
    };
  }

  return { success: true, remaining };
}

/**
 * Record actual token usage after a request. Call from onFinish when usage is available.
 * No-op when token limit is disabled.
 */
export async function recordLlmTokenUsage(userId: string, tokensUsed: number): Promise<void> {
  if (!isTokenLimitEnabled() || tokensUsed <= 0) return;
  await tokenLimiter.limit(userId, { rate: tokensUsed });
}

/**
 * Check cost-based limit using estimated cost in units. Call before request when cost limit is enabled.
 */
export async function checkLlmCostLimit(
  userId: string,
  estimatedCostUnits: number
): Promise<RateLimitResult> {
  if (!isCostLimitEnabled()) {
    return { success: true };
  }
  const { remaining } = await costLimiter.getRemaining(userId);

  if (remaining < estimatedCostUnits) {
    return {
      success: false,
      error: "Cost limit exceeded",
      remaining,
    };
  }

  return { success: true, remaining };
}

/**
 * Record actual cost after a request. Call from onFinish with modelId and usage.
 * No-op when cost limit is disabled.
 */
export async function recordLlmCost(userId: string, modelId: string, usage: Usage): Promise<void> {
  if (!isCostLimitEnabled()) return;
  const costUnits = computeCost(modelId, usage);

  if (costUnits <= 0) return;
  await costLimiter.limit(userId, { rate: costUnits });
}
