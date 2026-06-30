import { z } from "zod";

/**
 * Tool input schemas for {@link compileChatTools} and shared chat tools.
 *
 * Conventions for Vercel AI Gateway function-calling (all providers):
 * - No `z.string().min(1)` / `z.number().min(1)` — invalid on some backends.
 * - No `z.optional()` on parameters — use required fields; treat `""` as absent in execute.
 * - Clamp ranges and reject empty strings in tool `execute`, not in Zod.
 */

export const SearchMemoryToolSchema = z.object({
  query: z
    .string()
    .max(500)
    .describe(
      "The search query to find relevant memories. Should be a clear, specific question or topic."
    ),
});

export type SearchMemoryToolInput = z.infer<typeof SearchMemoryToolSchema>;

export const GetMoreMessagesToolSchema = z.object({
  limit: z
    .number()
    .int()
    .max(50)
    .describe(
      "Number of older messages to fetch (1–50). Use when you need more history to answer accurately."
    ),
});

export type GetMoreMessagesToolInput = z.infer<typeof GetMoreMessagesToolSchema>;

/** Clamp history fetch limit at execute time (schema avoids `.min(1)`). */
export function clampHistoryMessageLimit(limit: number | undefined, max = 50): number {
  return Math.min(max, Math.max(1, limit ?? 10));
}
