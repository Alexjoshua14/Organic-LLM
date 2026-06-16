import "server-only";

import type { HealthCheckResult } from "@/lib/health/types";

import { HEALTH_CHECK_TIMEOUT_MS, withTimeout } from "@/lib/health/with-timeout";
import { isTabTitleRedisConfigured } from "@/lib/metadata/tab-title-cache";
import { redis } from "@/lib/redis/redis";

function upstashConfig(): Record<string, string> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? "";
  let host = "";

  try {
    host = new URL(url).host;
  } catch {
    host = url ? "(set)" : "(unset)";
  }

  return { host, configured: isTabTitleRedisConfigured() ? "yes" : "no" };
}

export async function checkUpstash(): Promise<HealthCheckResult> {
  const start = performance.now();
  const config = upstashConfig();

  const base: Omit<HealthCheckResult, "status" | "latencyMs" | "summary"> = {
    id: "upstash",
    displayName: "Upstash",
    config,
  };

  if (!isTabTitleRedisConfigured()) {
    return {
      ...base,
      status: "skipped",
      latencyMs: null,
      summary: "Not configured",
      message: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    };
  }

  return withTimeout(
    HEALTH_CHECK_TIMEOUT_MS,
    async () => {
      try {
        const pong = await redis.ping();
        const latencyMs = Math.round(performance.now() - start);

        if (pong !== "PONG") {
          return {
            ...base,
            status: "down",
            latencyMs,
            summary: `Unexpected ping response: ${String(pong)}`,
          };
        }

        return {
          ...base,
          status: "ok",
          latencyMs,
          summary: "Reachable",
        };
      } catch (error) {
        const latencyMs = Math.round(performance.now() - start);
        const message = error instanceof Error ? error.message : String(error);

        return {
          ...base,
          status: "down",
          latencyMs,
          summary: message.length > 80 ? `${message.slice(0, 77)}…` : message,
          message,
        };
      }
    },
    () => ({
      ...base,
      status: "down",
      latencyMs: HEALTH_CHECK_TIMEOUT_MS,
      summary: "Request timed out",
      message: `No response within ${HEALTH_CHECK_TIMEOUT_MS}ms`,
    })
  );
}
