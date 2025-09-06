import z from "zod";

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
