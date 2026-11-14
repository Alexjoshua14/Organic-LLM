import Link from "next/link";

import { PerfSummaryTable } from "./_components/PerfSummaryTable";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  loadPerfSummary,
  parsePerfRange,
  PERF_RANGES,
  type PerfRange,
} from "@/lib/perf/summary-core";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const metadata = { title: "Performance · Admin" };
// Aggregates change every minute; never serve a cached copy of this page.
export const dynamic = "force-dynamic";

const RANGE_LABELS: Record<PerfRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

/**
 * Production timings, as aggregates. The page authorizes the caller itself (the layout's check
 * does not protect a page rendered on its own) and reads only the database's percentile
 * functions: no event, account or thread is ever loaded here, so nothing personal can render.
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin) return null;

  const range = parsePerfRange((await searchParams).range);
  const result = await loadPerfSummary(supabaseAdmin, range);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-medium">Performance</h1>
          <p className="max-w-xl text-xs text-muted-foreground">
            How long things really take for people who share anonymous timings. Budget: 250 ms.
            Totals only: measurements carry no account, chat or page address.
          </p>
        </div>
        <nav aria-label="Time range" className="flex gap-3 text-xs">
          {(Object.keys(PERF_RANGES) as PerfRange[]).map((key) => (
            <Link
              key={key}
              aria-current={key === range ? "page" : undefined}
              className={
                key === range
                  ? "text-foreground underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground"
              }
              href={`/admin/performance?range=${key}`}
            >
              {RANGE_LABELS[key]}
            </Link>
          ))}
        </nav>
      </div>

      {result.status === "pending" ? (
        <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          Migration pending. Apply <code>docs/migrations/perf_metrics.sql</code> in Supabase; until
          then nothing is collected and there is nothing to show.
        </p>
      ) : result.status === "error" ? (
        <p className="rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">
          Could not read the performance summary. Try again in a moment.
        </p>
      ) : result.rows.length === 0 ? (
        <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          No measurements in the last {RANGE_LABELS[range]} yet. Collection starts once someone has
          seen the notice and left sharing on.
        </p>
      ) : (
        <PerfSummaryTable daily={result.daily} rows={result.rows} />
      )}
    </div>
  );
}
