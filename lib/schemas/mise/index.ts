import { z } from "zod";

import { MiseCommandSchema, type MiseCommand } from "./command";
import { MiseViewSchema, type MiseView } from "./view";

export * from "./shared";
export * from "./event";
export * from "./recipe";
export * from "./ingredient";
export * from "./view";
export * from "./command";

/** Tool output for a mutation command (no UI block; plan updates via the data-mise channel). */
export const MiseAckOutputSchema = z.object({
  kind: z.literal("mise-ack"),
  applied: z.string(),
  count: z.number().int().optional(),
});

/** Tool output for SHOW_VIEW — anchors a `MiseView` in the thread. */
export const MiseViewOutputSchema = z.object({
  kind: z.literal("mise-view"),
  view: MiseViewSchema,
});

export const MisePlanToolOutputSchema = z.union([MiseAckOutputSchema, MiseViewOutputSchema]);

export type MiseAckOutput = z.infer<typeof MiseAckOutputSchema>;
export type MiseViewOutput = z.infer<typeof MiseViewOutputSchema>;
export type MisePlanToolOutput = z.infer<typeof MisePlanToolOutputSchema>;

export type SafeParseMiseCommandResult =
  | { ok: true; command: MiseCommand }
  | { ok: false; errors: z.ZodError };

/** Defensive re-parse of a streamed command on the client. */
export function safeParseMiseCommand(raw: unknown): SafeParseMiseCommandResult {
  const parsed = MiseCommandSchema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, command: parsed.data };
  }

  return { ok: false, errors: parsed.error };
}

/** Extract a `{ kind: "mise-view", view }` payload from raw tool output. */
export function extractMiseViewFromToolOutput(output: unknown): MiseView | null {
  const parsed = MiseViewOutputSchema.safeParse(output);

  return parsed.success ? parsed.data.view : null;
}
