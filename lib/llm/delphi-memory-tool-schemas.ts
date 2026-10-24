import { z } from "zod";

/** Max characters for a single memory body in propose / commit tools. */
export const DELPHI_MEMORY_TEXT_MAX = 8000;

/**
 * Function-calling backends expand Zod `.optional()` into `oneOf` branches; combined with
 * length constraints that can become invalid `enum` values. Use required fields and treat
 * `""` as absent at execute time instead.
 */
export const proposeMemoryInputSchema = z.object({
  text: z
    .string()
    .max(DELPHI_MEMORY_TEXT_MAX)
    .describe("Candidate memory text to show the user before a hard commit."),
  rationale: z
    .string()
    .max(500)
    .describe("Optional short note for logs only; pass empty string when not needed."),
});

export const commitMemoryInputSchema = z.object({
  text: z
    .string()
    .max(DELPHI_MEMORY_TEXT_MAX)
    .describe("Distilled memory text to store after soft commit or user confirmation."),
  topic: z
    .string()
    .max(200)
    .describe("Optional short topic label for metadata; pass empty string when not needed."),
});

export const linkMemoriesInputSchema = z.object({
  from_memory_id: z.string().max(256),
  to_memory_id: z.string().max(256),
  relationship: z
    .string()
    .max(120)
    .describe("Relationship label; pass empty string when not needed."),
});

export const flagPayloadSchema = z.object({
  note: z.string().max(2000).describe("Operator flag note."),
  context: z
    .string()
    .max(4000)
    .describe("Optional extra context for the flag; pass empty string when not needed."),
  memory_id: z
    .string()
    .max(256)
    .describe("Optional Mem0 memory id this flag relates to; pass empty string when not needed."),
});

/** Trim and reject empty tool text at execute time. */
export function requireDelphiToolText(value: string, field: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }

  return trimmed;
}

/** Treat required-but-unused tool string params (`""`) as absent. */
export function emptyOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";

  return trimmed === "" ? undefined : trimmed;
}
