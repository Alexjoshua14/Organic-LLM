import { describe, expect, mock, test } from "bun:test";

import {
  hasAgentAccounts,
  isAgentAccount,
  isAgentDeniedPath,
  isAgentWriteRequest,
  parseAgentClerkUserIds,
} from "@/lib/agent-account/agent-account";
import {
  AGENT_ALL_DAY_RATE_LIMIT,
  AGENT_ALL_MINUTE_RATE_LIMIT,
  AGENT_WRITE_DAY_RATE_LIMIT,
  catalogEntryById,
  type RateLimitCatalogEntry,
} from "@/lib/rate-limit/catalog";
import {
  checkAgentAccountRequest,
  type AgentLimit,
  type AgentLimiterResult,
} from "@/lib/rate-limit/agent-account";
import { getPublicPlanTiers } from "@/lib/plans/plan-capacity";
import { formatPlanCapUsd, getUsagePlanTier } from "@/lib/usage/plans";

const NOW = 1_800_000_000_000;
const AGENT = "user_agent";

function limiter(
  decide: (entry: RateLimitCatalogEntry) => Partial<AgentLimiterResult> = () => ({})
) {
  return mock<AgentLimit>(async (entry) => ({
    success: true,
    reset: NOW + 60_000,
    ...decide(entry),
  }));
}

describe("agent account allowlist", () => {
  test("parses a comma-separated env list and ignores blanks", () => {
    expect([...parseAgentClerkUserIds(" user_a, ,user_b ")]).toEqual(["user_a", "user_b"]);
    expect(hasAgentAccounts("")).toBe(false);
    expect(hasAgentAccounts("user_a")).toBe(true);
    expect(isAgentAccount("user_b", "user_a,user_b")).toBe(true);
    expect(isAgentAccount("user_c", "user_a,user_b")).toBe(false);
    expect(isAgentAccount(null, "user_a")).toBe(false);
  });

  test("voice session start and TTS are denied; other voice routes are not", () => {
    expect(isAgentDeniedPath("/api/ai/speak/realtime/session")).toBe(true);
    expect(isAgentDeniedPath("/api/ai/tts")).toBe(true);
    expect(isAgentDeniedPath("/api/ai/ttsx")).toBe(false);
    expect(isAgentDeniedPath("/api/chat")).toBe(false);
  });

  test("every non-safe method is a write, server actions included", () => {
    expect(isAgentWriteRequest("GET")).toBe(false);
    expect(isAgentWriteRequest("head")).toBe(false);
    expect(isAgentWriteRequest("POST")).toBe(true);
    expect(isAgentWriteRequest("DELETE")).toBe(true);
  });
});

describe("agent plan tier", () => {
  test("$0.50 a week, below free, and never listed publicly", () => {
    const agent = getUsagePlanTier("agent");

    expect(agent.costCapUsd).toBe(0.5);
    expect(agent.costCapUsd!).toBeLessThan(getUsagePlanTier("free").costCapUsd!);
    expect(getPublicPlanTiers().map((tier) => tier.id)).not.toContain("agent" as never);
    expect(formatPlanCapUsd(0.5)).toBe("$0.50");
    expect(formatPlanCapUsd(10)).toBe("$10");
  });
});

describe("agent account throttle", () => {
  test("a read spends one token from each all-requests bucket only", async () => {
    const limit = limiter();
    const decision = await checkAgentAccountRequest(
      { clerkUserId: AGENT, method: "GET", pathname: "/chat", now: NOW },
      limit
    );

    expect(decision).toEqual({ ok: true });
    expect(limit.mock.calls.map(([entry]) => entry.id)).toEqual([
      "agent.all.minute",
      "agent.all.hour",
      "agent.all.day",
    ]);
    expect(limit.mock.calls.every(([, key]) => key === AGENT)).toBe(true);
  });

  test("a write also spends from the write buckets", async () => {
    const limit = limiter();

    await checkAgentAccountRequest(
      { clerkUserId: AGENT, method: "POST", pathname: "/api/chat", now: NOW },
      limit
    );
    expect(limit.mock.calls.map(([entry]) => entry.id)).toContain("agent.write.minute");
    expect(limit.mock.calls.map(([entry]) => entry.id)).toContain("agent.write.day");
  });

  test("a full bucket refuses with the longest wait as Retry-After", async () => {
    const limit = limiter((entry) => {
      const resets: Record<string, number> = {
        [AGENT_ALL_MINUTE_RATE_LIMIT.id]: NOW + 5_000,
        [AGENT_WRITE_DAY_RATE_LIMIT.id]: NOW + 3_600_000,
      };

      return entry.id in resets ? { success: false, reset: resets[entry.id] } : {};
    });
    const decision = await checkAgentAccountRequest(
      { clerkUserId: AGENT, method: "POST", pathname: "/api/chat", now: NOW },
      limit
    );

    expect(decision).toEqual({
      ok: false,
      status: 429,
      code: "agent_rate_limit",
      error: AGENT_WRITE_DAY_RATE_LIMIT.error,
      retryAfter: 3_600,
    });
  });

  test("fails closed when Upstash errors or only admitted on timeout", async () => {
    const throwing = mock<AgentLimit>(async () => {
      throw new Error("redis down");
    });
    const timedOut = limiter((entry) =>
      entry.id === AGENT_ALL_DAY_RATE_LIMIT.id ? { reason: "timeout" } : {}
    );

    for (const limit of [throwing, timedOut]) {
      const decision = await checkAgentAccountRequest(
        { clerkUserId: AGENT, method: "GET", pathname: "/chat", now: NOW },
        limit
      );

      expect(decision).toMatchObject({ ok: false, status: 503 });
    }
  });

  test("voice is refused before any token is spent", async () => {
    const limit = limiter();
    const decision = await checkAgentAccountRequest(
      { clerkUserId: AGENT, method: "POST", pathname: "/api/ai/speak/realtime/session" },
      limit
    );

    expect(decision).toMatchObject({ ok: false, status: 403, code: "agent_surface_blocked" });
    expect(limit).not.toHaveBeenCalled();
  });

  test("every agent bucket is in the catalog for deny logs", () => {
    for (const id of [
      "agent.all.minute",
      "agent.all.hour",
      "agent.all.day",
      "agent.write.minute",
      "agent.write.day",
    ]) {
      expect(catalogEntryById(id)).toBeDefined();
    }
  });
});
