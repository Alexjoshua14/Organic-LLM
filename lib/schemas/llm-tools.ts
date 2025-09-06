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

export const TokenUsageSchema = z.object({
  cachedInputTokens: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  reasonTokens: z.number().optional(),
});

export const SparkUIMessageSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  tokenUsage: TokenUsageSchema.optional(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type SparkUIMessageMetadata = z.infer<typeof SparkUIMessageSchema>;

// Create a typed UIMessage
export type SparkUIMessage = UIMessage<SparkUIMessageMetadata>;
