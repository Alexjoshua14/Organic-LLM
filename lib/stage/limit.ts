import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

// Stage polls every 1.5s while the designer, a specialist or voice is active: 2,400 reads an hour
// on their own. The ceiling leaves room for refocus reads, failed-poll retries and a second tab.
const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6000, "1 h"),
  prefix: "ratelimit:stage:read",
});
// Framing checks are cached for 10 minutes per URL, so this only bounds a burst of new pages.
const webLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, "1 h"),
  prefix: "ratelimit:stage:web",
});
const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 h"),
  prefix: "ratelimit:stage:write",
});

export async function checkStageLimit(ownerId: string, write = false) {
  const limiter = write ? writeLimiter : readLimiter;
  return (await runLimiter("checkStageLimit", () => limiter.limit(ownerId))).success;
}

/** The web-page framing check has its own budget, so pages on the stage never cost state reads. */
export async function checkStageWebLimit(ownerId: string) {
  return (await runLimiter("checkStageWebLimit", () => webLimiter.limit(ownerId))).success;
}
