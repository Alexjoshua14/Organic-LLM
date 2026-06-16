import "server-only";

import type { HealthCheckResult } from "@/lib/health/types";

import { getOllamaConfig, getOllamaPlanModel } from "@/lib/ollama/client";
import { HEALTH_CHECK_TIMEOUT_MS, withTimeout } from "@/lib/health/with-timeout";

const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

function ollamaHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = process.env.OLLAMA_API_KEY;

  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  return headers;
}

function configuredModels(): string[] {
  const { model } = getOllamaConfig();
  const plan = getOllamaPlanModel();
  const models = new Set([model, plan, OLLAMA_EMBED_MODEL]);

  return [...models];
}

function displayHost(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);

    return u.host;
  } catch {
    return baseUrl;
  }
}

type TagsResponse = { models?: Array<{ name?: string }> };

export async function checkOllama(): Promise<HealthCheckResult> {
  const start = performance.now();
  const { baseUrl, model } = getOllamaConfig();
  const host = displayHost(baseUrl);
  const config: Record<string, string> = {
    host,
    model,
    planModel: getOllamaPlanModel(),
    embedModel: OLLAMA_EMBED_MODEL,
  };

  const base: Omit<HealthCheckResult, "status" | "latencyMs" | "summary"> = {
    id: "ollama",
    displayName: "Ollama",
    config,
  };

  return withTimeout(
    HEALTH_CHECK_TIMEOUT_MS,
    async () => {
      try {
        const res = await fetch(`${baseUrl}/api/tags`, {
          method: "GET",
          headers: ollamaHeaders(),
          signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
        });
        const latencyMs = Math.round(performance.now() - start);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");

          return {
            ...base,
            status: "down",
            latencyMs,
            summary: `tags returned ${res.status}`,
            message: errText.slice(0, 500) || undefined,
          };
        }

        const data = (await res.json()) as TagsResponse;
        const available = new Set(
          (data.models ?? [])
            .map((m) => m.name?.split(":")[0] ?? m.name)
            .filter((n): n is string => Boolean(n))
        );
        const required = configuredModels();
        const missing = required.filter((name) => {
          const baseName = name.split(":")[0];

          return (
            !available.has(name) &&
            !available.has(baseName) &&
            ![...available].some((a) => a.startsWith(`${baseName}:`))
          );
        });

        if (missing.length > 0) {
          return {
            ...base,
            status: "degraded",
            latencyMs,
            summary: `Model${missing.length > 1 ? "s" : ""} not loaded: ${missing.join(", ")}`,
            message: `Available: ${[...available].slice(0, 12).join(", ")}${available.size > 12 ? "…" : ""}`,
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
