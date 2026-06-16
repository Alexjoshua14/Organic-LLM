import { z } from "zod";

/** Max characters for a single memory body in propose / commit tools. */
export const DELPHI_MEMORY_TEXT_MAX = 8000;

export const proposeMemoryInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(DELPHI_MEMORY_TEXT_MAX)
    .describe("Candidate memory text to show the user before a hard commit."),
  rationale: z
    .string()
    .max(500)
    .optional()
    .describe("Optional short note for logs only; not stored in Mem0."),
});

export const commitMemoryInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(DELPHI_MEMORY_TEXT_MAX)
    .describe("Distilled memory text to store after soft commit or user confirmation."),
  topic: z.string().max(200).optional().describe("Optional short topic label for metadata."),
});

export const linkMemoriesInputSchema = z.object({
  from_memory_id: z.string().min(1).max(256),
  to_memory_id: z.string().min(1).max(256),
  relationship: z.string().max(120).optional(),
});

export const flagPayloadSchema = z.object({
  note: z.string().min(1).max(2000),
  context: z.string().max(4000).optional(),
});
