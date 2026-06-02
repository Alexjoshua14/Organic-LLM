import "server-only";

import { createLogger } from "../logger";

const logger = createLogger("ollama-config.ts");

export const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
export const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

/**
 * Headers for Ollama HTTP requests.
 *
 * Attaches a bearer token for the authenticating Ollama proxy (the token-gated
 * Cloudflare tunnel origin) when OLLAMA_API_KEY is set. Local/on-box Ollama
 * (localhost:11434) needs no auth, so we only warn about a missing key when
 * OLLAMA_URL points at a remote host — where a missing key means 401s.
 */
export function ollamaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  } else if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(OLLAMA_URL)) {
    logger.warn("ollamaHeaders", "OLLAMA_API_KEY not set for remote OLLAMA_URL.");
  }
  return headers;
}
