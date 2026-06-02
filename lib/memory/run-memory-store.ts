import { createLogger } from "@/lib/logger";
import { isMemoryApiSecretConfigured } from "@/lib/memory/qdrant-config";

const logger = createLogger("lib/memory/run-memory-store.ts");

let warnedMissingSecret = false;

/**
 * Wraps a memory store / Qdrant call so transport/auth failures surface a clear,
 * searchable log line before propagating. Without this, a misconfigured memory API
 * (e.g. unset/rotated `MEMORY_API_SECRET`, wrong `MEMORY_API_HOST` / `MEMORY_API_PORT`,
 * or Qdrant unreachable) throws a bare exception with no indication it is memory-related.
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
      "MEMORY_API_SECRET is not set — memory/Qdrant calls will likely fail; verify env configuration"
    );
  }

  try {
    return await op();
  } catch (error) {
    logger.error(
      context,
      "Memory store call failed — verify MEMORY_API_HOST / MEMORY_API_PORT / MEMORY_API_SECRET and Qdrant availability",
      error
    );
    throw error;
  }
}
