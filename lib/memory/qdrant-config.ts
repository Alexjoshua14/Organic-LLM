import { QdrantClient } from "@qdrant/js-client-rest";

import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/memory/qdrant-config.ts");

const LOCALHOST = "localhost";
const DEFAULT_LOCAL_PORT = 6333;
const DEFAULT_REMOTE_PORT = 443;
const MAX_PORT = 65535;

export type MemoryApiEnv = {
  host: string;
  port: number;
  apiKey: string | undefined;
  https: boolean;
};

let warnedInvalidPort = false;

/**
 * Resolves the Qdrant port from `MEMORY_API_PORT` when set to a valid value,
 * otherwise falls back to 6333 for localhost and 443 for remote hosts. An invalid
 * value logs once and falls back rather than throwing at import time.
 */
function resolvePort(host: string): number {
  const fallback = host === LOCALHOST ? DEFAULT_LOCAL_PORT : DEFAULT_REMOTE_PORT;
  const raw = process.env.MEMORY_API_PORT?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_PORT) {
    if (!warnedInvalidPort) {
      warnedInvalidPort = true;
      logger.warn("resolvePort", `Invalid MEMORY_API_PORT="${raw}"; falling back to ${fallback}`);
    }

    return fallback;
  }

  return parsed;
}

/**
 * Single source of truth for memory/Qdrant connection env:
 * `MEMORY_API_HOST`, `MEMORY_API_PORT`, `MEMORY_API_SECRET`.
 */
export function resolveMemoryApiEnv(): MemoryApiEnv {
  const host = process.env.MEMORY_API_HOST ?? LOCALHOST;

  return {
    host,
    port: resolvePort(host),
    apiKey: process.env.MEMORY_API_SECRET,
    https: host !== LOCALHOST,
  };
}

/** Builds a Qdrant client from the resolved memory API env. */
export function createQdrantClient(): QdrantClient {
  const { host, port, apiKey, https } = resolveMemoryApiEnv();

  return new QdrantClient({ host, port, https, apiKey });
}

/** True when `MEMORY_API_SECRET` is set to a non-empty value. */
export function isMemoryApiSecretConfigured(): boolean {
  return Boolean(process.env.MEMORY_API_SECRET?.trim());
}
