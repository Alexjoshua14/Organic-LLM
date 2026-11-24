import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

/** Own prefixes so the lab cannot exhaust real Stage's read/write allowance. */
const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6000, "1 h"),
  prefix: "ratelimit:jev-stage:read",
});
const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 h"),
  prefix: "ratelimit:jev-stage:write",
});

export async function checkJevStageLimit(ownerId: string, write = false) {
  const limiter = write ? writeLimiter : readLimiter;

  return (await runLimiter("checkJevStageLimit", () => limiter.limit(ownerId))).success;
}
