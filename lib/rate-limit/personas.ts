import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

/** Photo analysis runs two to three vision calls; a painting session needs a handful an hour. */
const paintingAnalysisLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  prefix: "ratelimit:personas:painting",
});

/**
 * One cheap Jev call per voice utterance. Generous, because a painting session is long and
 * mostly short asides; it only exists to stop a runaway client.
 */
const personaGateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(600, "1 h"),
  prefix: "ratelimit:personas:gate",
});

export async function checkPaintingAnalysisLimit(userId: string) {
  return runLimiter("checkPaintingAnalysisLimit", () => paintingAnalysisLimiter.limit(userId));
}

export async function checkPersonaGateLimit(userId: string) {
  return runLimiter("checkPersonaGateLimit", () => personaGateLimiter.limit(userId));
}
