import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/rate-limit/run-limiter.ts");

/**
 * Wraps an Upstash rate-limiter call so transport/auth failures surface a clear,
 * searchable log line before propagating. Without this, a misconfigured Upstash
 * (e.g. invalid/rotated `UPSTASH_REDIS_REST_TOKEN`, wrong `UPSTASH_REDIS_REST_URL`,
 * or Redis unreachable) throws a bare exception that bubbles up as an HTTP 500
 * with no indication it is Redis-related.
 *
 * Behavior is otherwise unchanged: successful calls and the normal
 * "limit exceeded" result pass through untouched. Timeout admissions emit a warning
 * metric without changing policy; thrown errors are logged and re-thrown.
 *
 * @param context Identifier for the failing call (e.g. the rate-limit function
 *   name) so logs point at the exact limiter that failed.
 * @param op Thunk performing the limiter call (`limiter.limit(...)` / `getRemaining(...)`).
 */
export async function runLimiter<T>(context: string, op: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await op();

    if (
      typeof result === "object" &&
      result !== null &&
      "reason" in result &&
      result.reason === "timeout" &&
      "success" in result &&
      result.success === true
    ) {
      // Do not send this telemetry through Redis: that dependency just timed out.
      logger.warn(context, "Upstash limiter admitted request after timeout", {
        metric: "rate_limit.timeout_admitted",
        count: 1,
        limiter: context,
        durationMs: performance.now() - startedAt,
      });
    }

    return result;
  } catch (error) {
    logger.error(
      context,
      "Upstash rate limiter call failed — verify UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN and Upstash availability",
      error
    );
    throw error;
  }
}
