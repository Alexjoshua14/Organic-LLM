import "server-only";

import { MEMORY_PRODUCTION_QDRANT_COLLECTION } from "@/config/memory-production-meta";
import type { HealthCheckResult } from "@/lib/health/types";
import { HEALTH_CHECK_TIMEOUT_MS, withTimeout } from "@/lib/health/with-timeout";
import { createQdrantClient, isMemoryApiSecretConfigured, resolveMemoryApiEnv } from "@/lib/memory/qdrant-config";

function memoryConfigRecord(): Record<string, string> {
  const { host, port, https } = resolveMemoryApiEnv();
  return {
    host,
    port: String(port),
    scheme: https ? "https" : "http",
    collection: MEMORY_PRODUCTION_QDRANT_COLLECTION,
    secretConfigured: isMemoryApiSecretConfigured() ? "yes" : "no",
  };
}

export async function checkMemoryQdrant(deep: boolean): Promise<HealthCheckResult> {
  const start = performance.now();
  const config = memoryConfigRecord();
  const { host, port, https, apiKey } = resolveMemoryApiEnv();
  const scheme = https ? "https" : "http";
  const healthUrl = `${scheme}://${host}:${port}/healthz`;

  const base: Omit<HealthCheckResult, "status" | "latencyMs" | "summary"> = {
    id: "memory",
    displayName: "Memory",
    config,
  };

  if (!isMemoryApiSecretConfigured()) {
    config.secretConfigured = "no";
  }

  return withTimeout(
    HEALTH_CHECK_TIMEOUT_MS,
    async () => {
      try {
        const headers: Record<string, string> = {};
        if (apiKey) headers["api-key"] = apiKey;

        const res = await fetch(healthUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
        });
        const latencyMs = Math.round(performance.now() - start);

        if (!res.ok) {
          return {
            ...base,
            status: "down",
            latencyMs,
            summary: `healthz returned ${res.status}`,
            message: await res.text().catch(() => undefined),
          };
        }

        if (!isMemoryApiSecretConfigured()) {
          return {
            ...base,
            status: "degraded",
            latencyMs,
            summary: "MEMORY_API_SECRET not set",
            message: "Qdrant may reject authenticated requests without MEMORY_API_SECRET.",
          };
        }

        if (!deep) {
          return {
            ...base,
            status: "ok",
            latencyMs,
            summary: "Reachable",
          };
        }

        const client = createQdrantClient();
        const collections = await client.getCollections();
        const names = (collections.collections ?? []).map((c) => c.name);
        const hasCollection = names.includes(MEMORY_PRODUCTION_QDRANT_COLLECTION);

        if (!hasCollection) {
          return {
            ...base,
            status: "degraded",
            latencyMs,
            summary: `Collection ${MEMORY_PRODUCTION_QDRANT_COLLECTION} missing`,
            message: `Found: ${names.slice(0, 8).join(", ") || "(none)"}`,
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
