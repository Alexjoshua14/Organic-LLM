import { z } from "zod";

import {
  PERF_MIN_SAMPLES_P95,
  PERF_MIN_SAMPLES_P99,
  PERF_DEFAULT_BUDGET_MS,
  perfBudgetFor,
} from "./budgets";
import { PERF_DEVICES, PERF_EVENT_KINDS, PERF_ROUTES } from "./events";
import { PERF_JOURNEYS, type PerfJourneyId } from "./journeys";

/**
 * Aggregates only. Everything here reads the database's percentile functions (which return one row
 * per group, never an event), validates each row against the same closed lists the events use, and
 * drops anything that does not fit. It takes the client as an argument so the admin page and tests
 * share it; the page, not this module, is responsible for authorizing the caller.
 */

export const PERF_RANGES = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;
export type PerfRange = keyof typeof PERF_RANGES;

export function parsePerfRange(value: unknown): PerfRange {
  return value === "24h" || value === "30d" ? value : "7d";
}

const num = z.coerce.number().finite();

const SummaryRowSchema = z.object({
  journey: z.enum(PERF_JOURNEYS),
  phase: z.string().max(40),
  kind: z.enum(PERF_EVENT_KINDS),
  route: z.enum(PERF_ROUTES),
  device: z.enum(PERF_DEVICES),
  samples: num,
  p50: num,
  p75: num,
  p95: num,
  p99: num,
  within_budget: num,
});

const DailyRowSchema = z.object({
  day: z.string().max(10),
  journey: z.enum(PERF_JOURNEYS),
  samples: num,
  p50: num,
  p95: num,
});

export type PerfSummaryRow = {
  journey: PerfJourneyId;
  phase: string;
  kind: "journey" | "phase";
  route: (typeof PERF_ROUTES)[number];
  device: (typeof PERF_DEVICES)[number];
  samples: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  withinBudget: number;
};
export type PerfDailyRow = {
  day: string;
  journey: PerfJourneyId;
  samples: number;
  p50: number;
  p95: number;
};

export type PerfSummaryResult =
  | { status: "ok"; since: string; rows: PerfSummaryRow[]; daily: PerfDailyRow[] }
  /** The migration has not been applied, so there is nothing to read yet. */
  | { status: "pending" }
  | { status: "error" };

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};

const isMissing = (error: { code?: string } | null) =>
  error?.code === "42883" ||
  error?.code === "42P01" ||
  error?.code === "PGRST202" ||
  error?.code === "PGRST205";

export async function loadPerfSummary(
  client: RpcClient,
  range: PerfRange,
  now: number = Date.now()
): Promise<PerfSummaryResult> {
  const since = new Date(now - PERF_RANGES[range]).toISOString();
  const [summary, daily] = await Promise.all([
    client.rpc("perf_summary", { p_since: since, p_budget_ms: PERF_DEFAULT_BUDGET_MS }),
    client.rpc("perf_daily", { p_since: since }),
  ]);

  if (isMissing(summary.error) || isMissing(daily.error)) return { status: "pending" };
  if (summary.error || daily.error) return { status: "error" };

  const rows: PerfSummaryRow[] = [];

  for (const raw of Array.isArray(summary.data) ? summary.data : []) {
    const parsed = SummaryRowSchema.safeParse(raw);

    if (!parsed.success) continue;
    const { within_budget, ...rest } = parsed.data;

    rows.push({ ...rest, withinBudget: within_budget });
  }

  const dailyRows: PerfDailyRow[] = [];

  for (const raw of Array.isArray(daily.data) ? daily.data : []) {
    const parsed = DailyRowSchema.safeParse(raw);

    if (parsed.success) dailyRows.push(parsed.data);
  }

  return { status: "ok", since, rows, daily: dailyRows };
}

export type PerfVerdict =
  | { level: "p99" | "p95"; pass: boolean }
  /** Too few samples for even p95: say so rather than guess. */
  | { level: "none"; pass: null };

/** Judges a row at the highest percentile its sample count can support. */
export function perfVerdict(row: PerfSummaryRow): PerfVerdict {
  const budget = perfBudgetFor(row.journey);

  if (row.samples >= PERF_MIN_SAMPLES_P99) return { level: "p99", pass: row.p99 <= budget };
  if (row.samples >= PERF_MIN_SAMPLES_P95) return { level: "p95", pass: row.p95 <= budget };

  return { level: "none", pass: null };
}

export const isP95Reliable = (samples: number) => samples >= PERF_MIN_SAMPLES_P95;
export const isP99Reliable = (samples: number) => samples >= PERF_MIN_SAMPLES_P99;

/**
 * Daily p95 values for a journey, with days that have too few samples left as gaps. A p95 from a
 * handful of events is the worst single event, so it is never drawn as a trend point.
 */
export function reliableDailyP95(daily: readonly PerfDailyRow[], journey: PerfJourneyId) {
  return daily
    .filter((d) => d.journey === journey)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      day: d.day,
      p50: d.p50,
      p95: isP95Reliable(d.samples) ? d.p95 : null,
      samples: d.samples,
    }));
}
