import { NextResponse } from "next/server";

import { listMemoryFeedback, listMemoryQualityDaily, fetchLastEvalRun } from "@/data/supabase/memory-quality";
import { requireAdmin } from "@/lib/admin/require-admin";
import { computeRecentDailyRollups } from "@/lib/memory/daily-rollups";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await computeRecentDailyRollups({ userId: admin.sbUserId, days: 30 });

  const [dailyResult, feedbackResult, lastEvalResult] = await Promise.all([
    listMemoryQualityDaily({ userId: admin.sbUserId, days: 30 }),
    listMemoryFeedback({ userId: admin.sbUserId, limit: 50 }),
    fetchLastEvalRun(admin.sbUserId),
  ]);

  if (dailyResult.error || feedbackResult.error || lastEvalResult.error) {
    return NextResponse.json(
      {
        error:
          dailyResult.error ?? feedbackResult.error ?? lastEvalResult.error ?? "Query failed",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    daily: dailyResult.data,
    feedback: feedbackResult.data,
    lastEval: lastEvalResult.data,
  });
}
