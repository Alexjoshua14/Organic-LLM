import { z } from "zod";

/** Schema version for all gen-UI blocks (bump when breaking). */
export const GEN_UI_VERSION = z.literal(1);

export const GEN_UI_BLOCK_TYPES = [
  "answer-card",
  "decision-matrix",
  "plan-timeline",
  "audio-snippet",
  "recipe-card",
  "shopping-list",
] as const;

export type GenUIBlockType = (typeof GEN_UI_BLOCK_TYPES)[number];

/** Catches invalid strings to undefined (drops bad decorative values). */
export function optionalStringCatch() {
  return z.string().optional().catch(undefined);
}

/**
 * An http(s)-only URL. `z.string().url()` (and `z.url()`) accept dangerous
 * schemes like `javascript:`, `data:`, and `vbscript:`; since gen-UI URLs are
 * model-supplied and rendered into `href`, restrict to http/https to prevent
 * click-triggered script execution via prompt injection.
 */
export function httpUrl() {
  return z
    .string()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "URL must use http(s)",
    });
}

/** Catches invalid array items while keeping valid ones. */
export function stringArrayWithCatch(max: number) {
  return z
    .array(z.string().catch(""))
    .max(max)
    .transform((arr) => arr.filter((s) => s.length > 0));
}
