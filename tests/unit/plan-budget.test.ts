import { describe, expect, mock, test } from "bun:test";

import { getChatErrorMessage } from "@/lib/chat/error-messages";
import {
  BUDGET_CYCLE_MS,
  budgetCycleRangeSpan,
  currentBudgetCycle,
  DEFAULT_BUDGET_CYCLE_ANCHOR,
  formatResetCountdown,
} from "@/lib/plans/budget-cycle";
import { getPlanBudgetForUser, type PlanBudgetDeps } from "@/lib/plans/plan-budget";
import { isPlanId, resolvePlan } from "@/lib/plans/plan-tags";

const ANCHOR = new Date("2026-10-01T09:30:00.000Z");
const NOW = new Date("2026-10-10T12:00:00.000Z");

describe("weekly budget cycles", () => {
  test("windows repeat every 7 days from the user's anchor", () => {
    const cycle = currentBudgetCycle(ANCHOR, NOW);

    expect(cycle.start.toISOString()).toBe("2026-10-08T09:30:00.000Z");
    expect(cycle.end.getTime() - cycle.start.getTime()).toBe(BUDGET_CYCLE_MS);
    // A reset moves the anchor to now: the fresh window starts immediately.
    expect(currentBudgetCycle(NOW, NOW).start).toEqual(NOW);
  });

  test("the default anchor turns over on Mondays at 00:00 UTC", () => {
    const { start } = currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR, NOW);

    expect(start.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(start.getUTCDay()).toBe(1);
  });

  test("ranges are whole cycles counted back from the current window", () => {
    const start = currentBudgetCycle(ANCHOR, NOW).start;
    const week = BUDGET_CYCLE_MS;

    expect(budgetCycleRangeSpan("current", start, NOW)).toEqual({ start, end: NOW });
    expect(budgetCycleRangeSpan("previous", start, NOW)).toEqual({
      start: new Date(start.getTime() - week),
      end: start,
    });
    expect(budgetCycleRangeSpan("last3", start, NOW).start).toEqual(
      new Date(start.getTime() - 2 * week)
    );
    expect(budgetCycleRangeSpan("last6", start, NOW).start).toEqual(
      new Date(start.getTime() - 5 * week)
    );
  });

  test("the reset countdown reads in days, hours, or minutes", () => {
    expect(formatResetCountdown(3 * 86_400_000 + 4 * 3_600_000)).toBe("3d 4h");
    expect(formatResetCountdown(5 * 3_600_000 + 12 * 60_000)).toBe("5h 12m");
    expect(formatResetCountdown(30_000)).toBe("1m");
    expect(formatResetCountdown(-5)).toBe("0m");
  });
});

function deps(overrides: Partial<PlanBudgetDeps> = {}) {
  return {
    readEntitlement: mock<PlanBudgetDeps["readEntitlement"]>(async () => ({
      status: "ok",
      entitlement: {
        plan: "pro",
        resetsRemaining: 25,
        cycleAnchor: ANCHOR,
        resetVersion: ANCHOR.toISOString(),
      },
    })),
    sumCost: mock<PlanBudgetDeps["sumCost"]>(async () => ({ status: "ok", usd: 4 })),
    clerkUserIdForProfile: mock<PlanBudgetDeps["clerkUserIdForProfile"]>(async () => null),
    // Explicit, so a developer's own allowlist in .env.local never changes these tests.
    agentEnvRaw: "",
    ...overrides,
  };
}

describe("agent test plan", () => {
  test("an allowlisted account is on the hidden agent plan: $0.50 a week, no resets", async () => {
    const d = deps({ agentEnvRaw: "user_agent" });
    const budget = await getPlanBudgetForUser(
      { clerkUserId: "user_agent", ownerId: "o1", now: NOW },
      d
    );

    expect(budget.plan).toBe("agent");
    expect(budget.source).toBe("override");
    expect(budget.capUsd).toBe(0.5);
    // The stored row says pro with 25 resets; the agent plan ignores both.
    expect(budget.resetsRemaining).toBe(0);
    expect(budget.canDispatch).toBe(false);
    expect(budget.holdReason).toContain("($0.50)");
  });

  test("background work without a Clerk id is still resolved to the agent plan", async () => {
    const clerkUserIdForProfile = mock(async () => "user_agent");
    const budget = await getPlanBudgetForUser(
      { ownerId: "o1", now: NOW },
      deps({
        agentEnvRaw: "user_agent",
        clerkUserIdForProfile,
        sumCost: async () => ({ status: "ok", usd: 0.1 }),
      })
    );

    expect(clerkUserIdForProfile).toHaveBeenCalledWith("o1");
    expect(budget.plan).toBe("agent");
    expect(budget.canDispatch).toBe(true);
    expect(budget.remainingUsd).toBeCloseTo(0.4);
  });

  test("an unreadable identity blocks while agent accounts are configured", async () => {
    const budget = await getPlanBudgetForUser(
      { ownerId: "o1", now: NOW },
      deps({
        agentEnvRaw: "user_agent",
        clerkUserIdForProfile: async () => {
          throw new Error("down");
        },
      })
    );

    expect(budget.status).toBe("unavailable");
    expect(budget.canDispatch).toBe(false);
  });

  test("a profile with no Clerk id blocks instead of falling back to free", async () => {
    const budget = await getPlanBudgetForUser(
      { ownerId: "o1", now: NOW },
      deps({
        agentEnvRaw: "user_agent",
        readEntitlement: async () => ({ status: "absent" }),
        sumCost: async () => ({ status: "ok", usd: 0 }),
      })
    );

    expect(budget.status).toBe("unavailable");
    expect(budget.canDispatch).toBe(false);
  });

  test("no identity lookup when no agent account is configured", async () => {
    const d = deps();

    await getPlanBudgetForUser({ ownerId: "o1", now: NOW }, d);
    expect(d.clerkUserIdForProfile).not.toHaveBeenCalled();
  });

  test("the agent list beats the max break-glass list", () => {
    expect(
      resolvePlan({
        clerkUserId: "user_x",
        storedPlan: "max",
        envRaw: "user_x",
        agentEnvRaw: "user_x",
      })
    ).toBe("agent");
    expect(
      resolvePlan({ clerkUserId: "user_x", storedPlan: "pro", envRaw: "", agentEnvRaw: "" })
    ).toBe("pro");
    // Not storable: an entitlement row can never claim the agent plan by itself.
    expect(isPlanId("agent")).toBe(false);
  });
});

describe("plan budget gate", () => {
  test("the verified plan, its weekly cap, and resets left decide", async () => {
    const d = deps();
    const budget = await getPlanBudgetForUser(
      { clerkUserId: "user_a", ownerId: "o1", now: NOW },
      d
    );

    expect(budget).toMatchObject({
      plan: "pro",
      source: "entitlements",
      capUsd: 25,
      usedUsd: 4,
      resetsRemaining: 25,
      canDispatch: true,
      cycleStart: "2026-10-08T09:30:00.000Z",
    });
    const [[spendArgs]] = d.sumCost.mock.calls;

    expect(spendArgs.since.toISOString()).toBe("2026-10-08T09:30:00.000Z");
  });

  test("before the migration, everyone is free on the Monday window with resets unavailable", async () => {
    const budget = await getPlanBudgetForUser(
      { clerkUserId: "user_b", ownerId: "o2", now: NOW },
      deps({ readEntitlement: async () => ({ status: "missing" }) })
    );

    expect(budget).toMatchObject({
      plan: "free",
      source: "default",
      resetsRemaining: null,
      canDispatch: true,
    });
    expect(budget.cycleStart).toBe("2026-10-05T00:00:00.000Z");
  });

  test("an unreadable entitlement or spend blocks new requests (fails closed)", async () => {
    const entitlementDown = await getPlanBudgetForUser(
      { clerkUserId: "user_c", ownerId: "o3", now: NOW },
      deps({ readEntitlement: async () => ({ status: "error" }) })
    );
    const spendDown = await getPlanBudgetForUser(
      { clerkUserId: "user_c", ownerId: "o3-fresh", now: NOW },
      deps({ sumCost: async () => ({ status: "error", message: "timeout" }) })
    );

    expect(entitlementDown.canDispatch).toBe(false);
    expect(spendDown.canDispatch).toBe(false);
    expect(spendDown.holdReason).toMatch(/can't be checked/);
  });

  test("a failed spend read blocks even immediately after a successful read", async () => {
    await getPlanBudgetForUser({ clerkUserId: "user_d", ownerId: "o4", now: NOW }, deps());
    const later = new Date(NOW.getTime() + 30_000);
    const budget = await getPlanBudgetForUser(
      { clerkUserId: "user_d", ownerId: "o4", now: later },
      deps({ sumCost: async () => ({ status: "error", message: "blip" }) })
    );

    expect(budget).toMatchObject({ canDispatch: false, status: "unavailable" });
  });

  test("at the cap, requests stop with when it resets", async () => {
    const budget = await getPlanBudgetForUser(
      { clerkUserId: "user_e", ownerId: "o5", now: NOW },
      deps({
        readEntitlement: async () => ({
          status: "ok",
          entitlement: {
            plan: "free",
            resetsRemaining: 5,
            cycleAnchor: ANCHOR,
            resetVersion: ANCHOR.toISOString(),
          },
        }),
        sumCost: async () => ({ status: "ok", usd: 10.01 }),
      })
    );

    expect(budget.canDispatch).toBe(false);
    expect(budget.cycleEnd).toBe("2026-10-15T09:30:00.000Z");
  });

  test("missing, negative, or non-finite spend never authorizes a call", async () => {
    for (const sumCost of [
      async () => ({ status: "missing" as const }),
      ...[-1, NaN, Infinity].map((usd) => async () => ({ status: "ok" as const, usd })),
    ]) {
      expect(
        (await getPlanBudgetForUser({ ownerId: "bad-spend", now: NOW }, deps({ sumCost })))
          .canDispatch
      ).toBe(false);
    }
  });

  test("max still pauses when spending cannot be verified", async () => {
    const budget = await getPlanBudgetForUser(
      { ownerId: "max-down", now: NOW },
      deps({
        readEntitlement: async () => ({
          status: "ok",
          entitlement: {
            plan: "max",
            resetsRemaining: 5,
            cycleAnchor: ANCHOR,
            resetVersion: ANCHOR.toISOString(),
          },
        }),
        sumCost: async () => ({ status: "error", message: "unavailable" }),
      })
    );
    expect(budget.canDispatch).toBe(false);
  });
});

describe("plan limit message in chat", () => {
  test("says why, when it resets, and that a reset is available", () => {
    const body = JSON.stringify({
      status: 429,
      code: "plan_limit",
      error: "You've used this week's Free plan allowance ($10).",
      resetAt: "2026-10-12T00:00:00.000Z",
      resetsRemaining: 5,
    });

    expect(getChatErrorMessage(new Error(body), new Date("2026-10-10T12:00:00.000Z"))).toBe(
      "You've used this week's Free plan allowance ($10). It resets in 1d 12h. You can start a fresh window now from Usage (5 resets left)."
    );
  });
});
