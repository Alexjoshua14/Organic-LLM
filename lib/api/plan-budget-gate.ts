import "server-only";

import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";

/** Machine-readable code on the 429 a spent plan returns, for client copy. */
export const PLAN_LIMIT_ERROR_CODE = "plan_limit";

/** The 429 every spending route returns when the user's weekly plan budget is spent. */
export function planLimitResponse(budget: PlanBudgetSnapshot): Response {
  const unavailable = budget.status === "unavailable";
  const status = unavailable ? 503 : 429;
  return new Response(
    JSON.stringify({
      error: budget.holdReason ?? "Plan usage limit reached",
      status,
      code: unavailable ? "plan_unavailable" : PLAN_LIMIT_ERROR_CODE,
      resetAt: budget.cycleEnd,
      resetsRemaining: budget.resetsRemaining,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Retry-After": unavailable
          ? "30"
          : String(Math.max(1, Math.ceil((Date.parse(budget.cycleEnd) - Date.now()) / 1000))),
      },
    }
  );
}

/**
 * Plan budget gate for any route that spends tokens, after it has resolved the user. Returns a
 * 429 `Response` when the weekly budget is spent (or cannot be checked), else null.
 */
export async function requirePlanBudget(args: {
  clerkUserId: string;
  sbUserId: string;
}): Promise<Response | null> {
  const budget = await getPlanBudgetForUser({
    clerkUserId: args.clerkUserId,
    ownerId: args.sbUserId,
  });

  return budget.canDispatch ? null : planLimitResponse(budget);
}
