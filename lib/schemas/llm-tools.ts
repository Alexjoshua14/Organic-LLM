import z from "zod";
import { UIMessage } from "ai";

export const ValidSummarySchema = z.object({
  valid: z.boolean().describe("Indicates whether the summary is valid."),
  reason: z
    .string()
    .max(400)
    .describe(
      "The reason for the validity of the summary. Must be under 400 characters.",
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
