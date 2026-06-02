import { z } from "zod";

/** Schema version for all gen-UI blocks (bump when breaking). */
export const GEN_UI_VERSION = z.literal(1);

export const GEN_UI_BLOCK_TYPES = [
  "answer-card",
  "decision-matrix",
  "plan-timeline",
  "audio-snippet",
] as const;

export type GenUIBlockType = (typeof GEN_UI_BLOCK_TYPES)[number];

/** Catches invalid strings to undefined (drops bad decorative values). */
export function optionalStringCatch() {
  return z.string().optional().catch(undefined);
}

/** Catches invalid array items while keeping valid ones. */
export function stringArrayWithCatch(max: number) {
  return z
    .array(z.string().catch(""))
    .max(max)
    .transform((arr) => arr.filter((s) => s.length > 0));
}
