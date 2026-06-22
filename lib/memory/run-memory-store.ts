import { createLogger } from "@/lib/logger";
import { diagnoseMemoryStoreFailure } from "@/lib/memory/memory-store-failure";
import { isMemoryApiSecretConfigured } from "@/lib/memory/qdrant-config";
import { isLocalOllamaUrl, OLLAMA_API_KEY, OLLAMA_URL } from "@/lib/memory/ollama-config";

const logger = createLogger("lib/memory/run-memory-store.ts");

let warnedMissingSecret = false;
let warnedRemoteOllamaAuth = false;

/**
 * Wraps a memory store / Qdrant call so transport/auth failures surface a clear,
 * searchable log line before propagating. Without this, a misconfigured memory API
 * (e.g. unset/rotated `MEMORY_API_SECRET`, wrong `MEMORY_API_HOST` / `MEMORY_API_PORT`,
 * unreachable Ollama embedder, or Qdrant down) throws a bare exception with no
 * indication it is memory-related.
 *
 * Behavior is otherwise unchanged: successful calls pass through untouched; only thrown
 * errors are logged and then re-thrown so callers keep their existing fail-open semantics.
 *
 * @param context Identifier for the failing call (e.g. the store function name) so logs
 *   point at the exact operation that failed.
 * @param op Thunk performing the memory store / Qdrant call.
 */
export async function runMemoryStore<T>(context: string, op: () => Promise<T>): Promise<T> {
  if (!warnedMissingSecret && !isMemoryApiSecretConfigured()) {
    warnedMissingSecret = true;
    logger.warn(
      context,
      "MEMORY_API_SECRET is not set — memory/Qdrant calls will likely fail; verify env configuration",
    );
  }

  if (!warnedRemoteOllamaAuth && !isLocalOllamaUrl() && !OLLAMA_API_KEY) {
    warnedRemoteOllamaAuth = true;
    logger.warn(
      context,
      `OLLAMA_URL is remote (${OLLAMA_URL}) but OLLAMA_API_KEY is unset — Mem0 embedder calls will likely fail with 401`,
    );
  }

  try {
    return await op();
  } catch (error) {
    const diagnosis = diagnoseMemoryStoreFailure(error);
    const err = error instanceof Error ? error : null;

    logger.error(
      context,
      `Memory store call failed [${diagnosis.kind}] — ${diagnosis.hint}`,
      {
        failureKind: diagnosis.kind,
        ...(diagnosis.detail ? { failureDetail: diagnosis.detail } : {}),
        ...(err ? { errorName: err.name, errorMessage: err.message } : { thrown: String(error) }),
      },
      error,
    );
    throw error;
  }
}
