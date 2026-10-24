import { z } from "zod";

/** Structured release notes for one git SHA range. */
export const ReleaseNotesSchema = z.object({
  headline: z
    .string()
    .min(1)
    .max(160)
    .describe("One short headline for this version range, layman-friendly."),
  summary: z
    .string()
    .min(1)
    .max(1200)
    .describe("2–4 sentences describing what changed, for a non-technical reader."),
  highlights: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        detail: z.string().min(1).max(280),
      })
    )
    .max(8)
    .describe("Up to 8 concrete changes. Empty if there were no meaningful user-facing changes."),
});

export type ReleaseNotes = z.infer<typeof ReleaseNotesSchema>;

export const ReleaseNotesCachePayloadSchema = z.object({
  fromSha: z.string().min(7),
  toSha: z.string().min(7),
  fromVersion: z.string().nullable(),
  toVersion: z.string().nullable(),
  commitCount: z.number().int().nonnegative(),
  notes: ReleaseNotesSchema,
  model: z.string().min(1),
  generatedAt: z.string().datetime(),
});

export type ReleaseNotesCachePayload = z.infer<typeof ReleaseNotesCachePayloadSchema>;
