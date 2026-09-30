import { NextResponse } from "next/server";

import { listMemoryQualityDaily, fetchLastEvalRun } from "@/data/supabase/memory-quality";
import { requireAdmin } from "@/lib/admin/require-admin";
import { computeRecentDailyRollups } from "@/lib/memory/daily-rollups";
import { readAdminMemoryFeedback } from "@/data/supabase/admin-memory-feedback";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);

  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) {
    return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  }

  try {
    await computeRecentDailyRollups({ userId: admin.sbUserId, days: 30 });

    const [dailyResult, feedbackResult, lastEvalResult] = await Promise.all([
      listMemoryQualityDaily({ userId: admin.sbUserId, days: 30 }),
      readAdminMemoryFeedback(offset),
      fetchLastEvalRun(admin.sbUserId),
    ]);

    if (dailyResult.error || lastEvalResult.error) {
      return NextResponse.json(
        {
          error: "Metrics are unavailable.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        daily: dailyResult.data,
        feedback: feedbackResult.rows,
        feedbackCounts: feedbackResult.counts,
        feedbackHasMore: feedbackResult.hasMore,
        lastEval: lastEvalResult.data,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Metrics are unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
