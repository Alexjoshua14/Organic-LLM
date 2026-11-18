import { Ratelimit } from "@upstash/ratelimit";

import { isAgentDeniedPath, isAgentWriteRequest } from "@/lib/agent-account/agent-account";
import { createLogger } from "@/lib/logger";
import { redis } from "@/lib/redis/redis";
import {
  AGENT_ALL_RATE_LIMITS,
  AGENT_WRITE_RATE_LIMITS,
  type RateLimitCatalogEntry,
} from "@/lib/rate-limit/catalog";

/**
 * Whole-account throttle for agent test accounts, run by `proxy.ts` before any route. Every
 * matched request spends one token from each `agent.all.*` bucket; writes also spend one from
 * each `agent.write.*` bucket. Tokens are spent in parallel, so a denied request still counts:
 * an agent that keeps retrying stays blocked instead of slipping through at the window edge.
 *
 * Fails closed: if Upstash errors or times out, the agent's request is refused. Other accounts
 * never reach this code.
 */

const logger = createLogger("lib/rate-limit/agent-account.ts");

export type AgentLimiterResult = {
  success: boolean;
  reset: number;
  /** Upstash sets "timeout" when it admitted the request without reaching Redis. */
  reason?: string;
};

export type AgentLimit = (
  entry: RateLimitCatalogEntry,
  clerkUserId: string
) => Promise<AgentLimiterResult>;

export type AgentRequestDecision =
  | { ok: true }
  | { ok: false; status: number; code: string; error: string; retryAfter: number };

const limiters = new Map<string, Ratelimit>();

function limiterFor(entry: RateLimitCatalogEntry): Ratelimit {
  let limiter = limiters.get(entry.id);

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(entry.cap, entry.window),
      prefix: entry.prefix,
    });
    limiters.set(entry.id, limiter);
  }

  return limiter;
}

const upstashLimit: AgentLimit = (entry, clerkUserId) => limiterFor(entry).limit(clerkUserId);

/** Retry-After for an unknown reset: long enough that a polling agent backs off. */
const UNAVAILABLE_RETRY_AFTER_SECONDS = 30;

export async function checkAgentAccountRequest(
  input: { clerkUserId: string; method: string; pathname: string; now?: number },
  limit: AgentLimit = upstashLimit
): Promise<AgentRequestDecision> {
  if (isAgentDeniedPath(input.pathname)) {
    return {
      ok: false,
      status: 403,
      code: "agent_surface_blocked",
      error: "Voice is not available to agent test accounts.",
      retryAfter: 0,
    };
  }

  const entries: RateLimitCatalogEntry[] = [
    ...AGENT_ALL_RATE_LIMITS,
    ...(isAgentWriteRequest(input.method) ? AGENT_WRITE_RATE_LIMITS : []),
  ];
  let results: AgentLimiterResult[];

  try {
    results = await Promise.all(entries.map((entry) => limit(entry, input.clerkUserId)));
  } catch (error) {
    logger.error("checkAgentAccountRequest", "Agent throttle unavailable; refusing request", {
      errorName: error instanceof Error ? error.name : typeof error,
    });

    return unavailable();
  }

  if (results.some((result) => result.reason === "timeout")) {
    logger.warn("checkAgentAccountRequest", "Agent throttle timed out; refusing request");

    return unavailable();
  }

  const now = input.now ?? Date.now();
  const denied = entries
    .map((entry, index) => ({ entry, result: results[index]! }))
    .filter(({ result }) => !result.success)
    // Report the bucket that stays closed longest, so Retry-After is honest.
    .sort((a, b) => b.result.reset - a.result.reset)[0];

  if (!denied) return { ok: true };

  logger.warn("checkAgentAccountRequest", "Agent account throttled", {
    limiter: denied.entry.id,
    cap: denied.entry.cap,
    window: denied.entry.window,
  });

  return {
    ok: false,
    status: 429,
    code: "agent_rate_limit",
    error: denied.entry.error,
    retryAfter: Math.max(1, Math.ceil((denied.result.reset - now) / 1000)),
  };
}

function unavailable(): AgentRequestDecision {
  return {
    ok: false,
    status: 503,
    code: "agent_rate_limit_unavailable",
    error: "Agent account limits can't be checked right now.",
    retryAfter: UNAVAILABLE_RETRY_AFTER_SECONDS,
  };
}
