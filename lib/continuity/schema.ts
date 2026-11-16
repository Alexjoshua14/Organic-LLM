import { z } from "zod";

export const ContinuitySourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("speak-thread"),
      threadId: z.string().uuid(),
      version: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("stage-artifact"),
      artifactId: z.string().uuid(),
      workspaceRevision: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type ContinuitySource = z.infer<typeof ContinuitySourceSchema>;
export const ContinuitySelectionSchema = z
  .object({
    interactionId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type ContinuitySelection = z.infer<typeof ContinuitySelectionSchema>;
export const ContinuityInteractionSchema = z
  .object({
    schemaVersion: z.literal(1),
    interactionId: z.string().uuid(),
    surface: z.enum(["speak", "stage"]),
    revision: z.number().int().nonnegative(),
    selected: ContinuitySourceSchema.nullable(),
    expiresAt: z.number().int(),
    receipts: z
      .array(
        z.object({
          requestId: z.string().uuid(),
          fingerprint: z.string(),
          revision: z.number().int(),
          selected: ContinuitySourceSchema.nullable(),
        })
      )
      .max(64),
  })
  .strict();
export type ContinuityInteraction = z.infer<typeof ContinuityInteractionSchema>;

export type ContinuityBinding = ContinuitySelection & { source: ContinuitySource | null };
