import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
} as const;

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Retries a function with exponential backoff
 * @param fn - The async function to retry
 * @param config - Retry configuration options
 * @returns The result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
    initialDelayMs = DEFAULT_RETRY_CONFIG.initialDelayMs,
    maxDelayMs = DEFAULT_RETRY_CONFIG.maxDelayMs,
    backoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier,
    onRetry,
  } = config;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff, capped at maxDelayMs
      const currentDelay = Math.min(delay, maxDelayMs);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, currentDelay);
      }

      await sleep(currentDelay);
      delay *= backoffMultiplier;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Compares two date strings (ISO or RFC, or values parseable by Date).
 * Returns:
 *   - -1 if a < b,
 *   -  1 if a > b,
 *   -  0 if a == b (or both are falsy/invalid/undefined)
 *
 * @param a - First date string or Date or undefined/null
 * @param b - Second date string or Date or undefined/null
 */
export function dateStringCompare(
  a?: string | Date | null,
  b?: string | Date | null,
): -1 | 0 | 1 {
  const toDate = (x: string | Date | null | undefined): number => {
    if (!x) return NaN;
    if (x instanceof Date) return x.getTime();
    const d = new Date(x);
    return isNaN(d.getTime()) ? NaN : d.getTime();
  };

  const aTime = toDate(a);
  const bTime = toDate(b);

  if (isNaN(aTime) && isNaN(bTime)) return 0;
  if (!isNaN(aTime) && isNaN(bTime)) return 1;
  if (isNaN(aTime) && !isNaN(bTime)) return -1;

  if (aTime < bTime) return -1;
  if (aTime > bTime) return 1;
  return 0;
}

/**
 * Check if a string is a Unix timestamp (numeric string)
 */
export function isUnixTimestamp(value: string): boolean {
  return /^\d+$/.test(value) && value.length >= 10;
}
