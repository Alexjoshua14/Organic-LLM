import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const readLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3000, "1 h"), prefix: "ratelimit:stage:read" });
const writeLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 h"), prefix: "ratelimit:stage:write" });

export async function checkStageLimit(ownerId: string, write = false) {
  const limiter = write ? writeLimiter : readLimiter;
  return (await runLimiter("checkStageLimit", () => limiter.limit(ownerId))).success;
}
