import z from "zod";

export const ValidSummarySchema = z.object({
  valid: z.boolean().describe("Indicates whether the summary is valid."),
});

export type ValidSummary = z.infer<typeof ValidSummarySchema>;
