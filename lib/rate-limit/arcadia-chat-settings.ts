import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

/** Arcadia chat settings modal: bucket capacity (max stored generations). */
const ARCADIA_SETTINGS_GENERATION_CAPACITY = 5;

/** Arcadia chat settings modal: tokens refilled per minute. */
const ARCADIA_SETTINGS_GENERATION_REFILL_PER_MIN = 2;

/** Arcadia chat settings modal: hard cap per sliding minute window. */
const ARCADIA_SETTINGS_GENERATION_BURST_PER_MIN = 5;

export type ArcadiaChatSettingsGenerationKind = "title" | "summary";

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  error?: string;
};

function createArcadiaSettingsLimiter(prefix: string) {
  const bucketLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(
      ARCADIA_SETTINGS_GENERATION_REFILL_PER_MIN,
      "1 m",
      ARCADIA_SETTINGS_GENERATION_CAPACITY
    ),
    prefix: `${prefix}:bucket`,
  });

  const burstLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      ARCADIA_SETTINGS_GENERATION_BURST_PER_MIN,
      "1 m"
    ),
    prefix: `${prefix}:burst`,
  });

  return { bucketLimiter, burstLimiter };
}

const titleLimiter = createArcadiaSettingsLimiter("ratelimit:arcadia-settings:title");
const summaryLimiter = createArcadiaSettingsLimiter("ratelimit:arcadia-settings:summary");

async function checkArcadiaSettingsGenerationLimit(
  kind: ArcadiaChatSettingsGenerationKind,
  userId: string,
  chatId: string
): Promise<RateLimitResult> {
  const key = `${userId}:${chatId}`;
  const { bucketLimiter, burstLimiter } =
    kind === "title" ? titleLimiter : summaryLimiter;
  const label = kind === "title" ? "title" : "summary";

  const burst = await runLimiter(`checkArcadiaSettingsGenerationLimit:${kind}:burst`, () =>
    burstLimiter.limit(key)
  );

  if (!burst.success) {
    return {
      success: false,
      error: `${label[0].toUpperCase()}${label.slice(1)} regeneration limit reached (max ${ARCADIA_SETTINGS_GENERATION_BURST_PER_MIN} per minute). Try again shortly.`,
    };
  }

  const bucket = await runLimiter(`checkArcadiaSettingsGenerationLimit:${kind}:bucket`, () =>
    bucketLimiter.limit(key)
  );

  if (!bucket.success) {
    return {
      success: false,
      error: `This chat has reached its ${label} regeneration limit. Refills ${ARCADIA_SETTINGS_GENERATION_REFILL_PER_MIN} per minute (max ${ARCADIA_SETTINGS_GENERATION_CAPACITY}).`,
    };
  }

  return {
    success: true,
    remaining: Math.min(
      burst.remaining ?? ARCADIA_SETTINGS_GENERATION_BURST_PER_MIN,
      bucket.remaining ?? ARCADIA_SETTINGS_GENERATION_CAPACITY
    ),
  };
}

export async function checkArcadiaSettingsTitleLimit(
  userId: string,
  chatId: string
): Promise<RateLimitResult> {
  return checkArcadiaSettingsGenerationLimit("title", userId, chatId);
}

export async function checkArcadiaSettingsSummaryLimit(
  userId: string,
  chatId: string
): Promise<RateLimitResult> {
  return checkArcadiaSettingsGenerationLimit("summary", userId, chatId);
}
