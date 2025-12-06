import z from "zod";
import { UIMessage } from "ai";

export const ValidSummarySchema = z.object({
  valid: z.boolean().describe("Indicates whether the summary is valid."),
  reason: z
    .string()
    .max(400)
    .describe(
      "The reason for the validity of the summary. Must be under 400 characters."
    ),
});

export type ValidSummary = z.infer<typeof ValidSummarySchema>;

export const SparkUIMessageSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
});

export type SparkUIMessageMetadata = z.infer<typeof SparkUIMessageSchema>;

// Create a typed UIMessage
export type SparkUIMessage = UIMessage<SparkUIMessageMetadata>;

/**
 * Schema for memory search tool input
 */
export const SearchMemoryToolSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "The search query to find relevant memories. Should be a clear, specific question or topic."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe(
      "The maximum number of memories to return. Defaults to 3, maximum is 10."
    ),
});

export type SearchMemoryToolInput = z.infer<typeof SearchMemoryToolSchema>;
