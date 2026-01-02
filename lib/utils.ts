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
  config: RetryConfig = {}
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
