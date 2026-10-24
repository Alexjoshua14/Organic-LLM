import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { buildUsageSummaryForUser } from "@/data/supabase/llm-usage";
import { getSupabaseUserId, isAdminUser } from "@/data/supabase/profiles";
import { isBudgetCycleRange } from "@/lib/plans/budget-cycle";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";
import { getGatewaySpendSummary } from "@/lib/usage/gateway-spend";

/**
 * GET /api/usage?range=current|previous|last3|last6 — usage by weekly budget cycle, plus the
 * user's verified plan, spend in the current window, when it resets, and resets left.
 */
export async function GET(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const rawRange = searchParams.get("range");
  const range = isBudgetCycleRange(rawRange) ? rawRange : "current";
  const plan = await getPlanBudgetForUser({
    clerkUserId: clerkUser.userId,
    ownerId: sbUserIdResult.data,
  });
  const summary = await buildUsageSummaryForUser({ ownerId: sbUserIdResult.data, range, plan });

  if (await isAdminUser(clerkUser.userId)) {
    summary.gatewaySpend = await getGatewaySpendSummary({
      ownerId: sbUserIdResult.data,
      startDate: summary.range.start.slice(0, 10),
      endDate: summary.range.end.slice(0, 10),
    });
  }

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
