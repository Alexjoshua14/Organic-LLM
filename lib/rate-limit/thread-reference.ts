import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 h"),
  prefix: "ratelimit:thread-reference-essence",
});

export async function canGenerateThreadEssence(ownerId: string): Promise<boolean> {
  return (await runLimiter("thread-reference-essence", () => limiter.limit(ownerId))).success;
}
