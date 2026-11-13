import { Tiktoken } from "js-tiktoken/lite";
import o200kBase from "js-tiktoken/ranks/o200k_base";

import { approximateTokenCount } from "@/lib/chat/approximate-token-count";

/**
 * The app's tokenizer: `o200k_base`, the encoding gpt-5 uses. Its ranks are 2.3 MB, so only
 * server code, the token worker and the worker's fallback load this module. Client components
 * count through `lib/chat/background-token-counter.ts` instead.
 */
let encoder: Tiktoken | null = null;

/**
 * The shared encoder. Building it takes about 100 ms, so it waits for the first use, and every
 * caller reuses it. Its `encode` throws on special tokens; {@link estimateTokenCountSync} doesn't.
 */
export function getTokenEncoder(): Tiktoken {
  encoder ??= new Tiktoken(o200kBase);

  return encoder;
}

/** Synchronous token count. Text the encoder rejects (special tokens) is approximated. */
export function estimateTokenCountSync(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  try {
    return getTokenEncoder().encode(trimmed).length;
  } catch {
    return approximateTokenCount(trimmed);
  }
}
