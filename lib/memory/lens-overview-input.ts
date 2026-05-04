import "server-only";

import { encodingForModel } from "js-tiktoken";

/** Gateway model id for memory lens page summaries (cheap, high throughput). */
export const LENS_OVERVIEW_MODEL = "openai/gpt-5-nano" as const;

/** Max tokens for serialized memory lines sent to the model (system prompt is separate). */
export const LENS_OVERVIEW_MEMORY_BLOB_MAX_TOKENS = 1000;

/**
 * Builds a newline list of memory texts and trims from the end until the blob is at most
 * `LENS_OVERVIEW_MEMORY_BLOB_MAX_TOKENS` tokens (cl100k_base via gpt-5 encoding).
 */
export function truncateMemoryBlobToTokenCap(orderedTexts: string[]): string {
  if (orderedTexts.length === 0) return "";
  const encoding = encodingForModel("gpt-5");
  const lines = orderedTexts
    .map((t) => `- ${t.replace(/\s+/g, " ").trim()}`)
    .filter((l) => l.length > 2);
  let blob = lines.join("\n");

  const count = (s: string) => encoding.encode(s).length;

  if (count(blob) <= LENS_OVERVIEW_MEMORY_BLOB_MAX_TOKENS) return blob;

  let best = 0;
  let lo = 0;
  let hi = blob.length;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const slice = blob.slice(0, mid);

    if (count(slice) <= LENS_OVERVIEW_MEMORY_BLOB_MAX_TOKENS) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return blob.slice(0, best).trimEnd();
}
