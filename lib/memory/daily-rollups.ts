import "server-only";

import {
  fetchFeedbackCountsForDay,
  fetchMemoryQualityEventsForDay,
  upsertMemoryQualityDailyRow,
} from "@/data/supabase/memory-quality";
import type { MemoryQualitySource } from "@/lib/schemas/memory-quality";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/memory/daily-rollups");

const SOURCES: MemoryQualitySource[] = ["delphi", "auto_ingest", "migration", "eval", "unknown"];

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;

  return sorted[Math.max(0, idx)] ?? null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeRollupForSource(
  events: Array<{
    event: string;
    source: string;
    char_count: number | null;
  }>,
  source: MemoryQualitySource | "all",
  feedbackUp: number,
  feedbackDown: number
) {
  const filtered =
    source === "all" ? events : events.filter((e) => e.source === source);

  const ingestCount = filtered.filter((e) => e.event === "ingest").length;
  const deleteCount = filtered.filter((e) => e.event === "delete").length;
  const charCounts = filtered
    .filter((e) => e.event === "ingest" && typeof e.char_count === "number")
    .map((e) => e.char_count as number)
    .sort((a, b) => a - b);

  const deleteRate =
    ingestCount + deleteCount > 0 ? deleteCount / (ingestCount + deleteCount) : null;
  const positiveRate =
    feedbackUp + feedbackDown > 0 ? feedbackUp / (feedbackUp + feedbackDown) : null;

  return {
    ingest_count: ingestCount,
    delete_count: deleteCount,
    feedback_up: source === "all" ? feedbackUp : 0,
    feedback_down: source === "all" ? feedbackDown : 0,
    char_count_mean: mean(charCounts),
    char_count_p50: percentile(charCounts, 50),
    char_count_p90: percentile(charCounts, 90),
    delete_rate: deleteRate,
    positive_rate: positiveRate,
  };
}

/**
 * Aggregates raw events for a calendar day into `memory_quality_daily` rows.
 */
export async function computeDailyRollupsForUser(args: {
  userId: string;
  day?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const day = args.day ?? new Date().toISOString().slice(0, 10);

  const [eventsResult, feedbackResult] = await Promise.all([
    fetchMemoryQualityEventsForDay({ userId: args.userId, day }),
    fetchFeedbackCountsForDay({ userId: args.userId, day }),
  ]);

  if (eventsResult.error) {
    return { ok: false, error: eventsResult.error };
  }
  if (feedbackResult.error) {
    return { ok: false, error: feedbackResult.error };
  }

  const events = eventsResult.data;

  for (const source of SOURCES) {
    const rollup = computeRollupForSource(events, source, 0, 0);
    const result = await upsertMemoryQualityDailyRow({
      user_id: args.userId,
      day,
      source,
      ...rollup,
      char_count_mean: rollup.char_count_mean,
    });

    if (!result.ok) {
      logger.error("computeDailyRollupsForUser", result.error ?? "upsert failed");

      return { ok: false, error: result.error };
    }
  }

  const allRollup = computeRollupForSource(
    events,
    "all",
    feedbackResult.up,
    feedbackResult.down
  );
  const allResult = await upsertMemoryQualityDailyRow({
    user_id: args.userId,
    day,
    source: "all",
    ...allRollup,
    char_count_mean: allRollup.char_count_mean,
  });

  if (!allResult.ok) {
    return { ok: false, error: allResult.error };
  }

  return { ok: true };
}

/** Recompute rollups for today and the previous N days. */
export async function computeRecentDailyRollups(args: {
  userId: string;
  days?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const days = args.days ?? 7;

  for (let i = 0; i < days; i++) {
    const d = new Date();

    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const result = await computeDailyRollupsForUser({ userId: args.userId, day });

    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}
