import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

/**
 * Performance ingest and consent (POST /api/perf/ingest, GET/PUT /api/perf/consent): 600 per hour
 * per user. Reporters flush at most every 30 seconds while a tab is open, so honest use sits far
 * below this; the limit only stops a runaway or hostile client from filling the table. The key is
 * the already-authenticated user id and lives in the limiter only, never next to a stored metric.
 */
const perfLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(600, "1 h"),
  prefix: "ratelimit:perf",
});

export async function checkPerfLimit(userId: string): Promise<{ success: boolean }> {
  const { success } = await runLimiter("checkPerfLimit", () => perfLimiter.limit(userId));

  return { success };
}
