import type { TextTokenCounter } from "@/lib/chat/context-budget";

import { approximateTokenCount } from "@/lib/chat/approximate-token-count";
import { runInIdleSlices } from "@/lib/idle-work";

/**
 * Client token counting that stays out of the initial bundle and off busy frames. The tokenizer
 * (`lib/chat/tokenizer`, 2.3 MB of ranks) loads on the first count, through a dynamic import,
 * and texts are counted in idle slices. If it can't load, counts are approximated.
 */

type Tokenizer = { estimateTokenCountSync: (text: string) => number };

let tokenizer: Promise<Tokenizer | null> | null = null;

function loadTokenizer(): Promise<Tokenizer | null> {
  tokenizer ??= import("@/lib/chat/tokenizer").catch(() => null);

  return tokenizer;
}

/** Counts `texts` in idle slices with `count`, resolving with every count in order. */
export function countInIdleSlices(
  texts: readonly string[],
  count: (text: string) => number
): Promise<number[]> {
  return new Promise((resolve) => {
    const counts: number[] = [];

    runInIdleSlices((hasTimeLeft) => {
      while (counts.length < texts.length && hasTimeLeft()) {
        counts.push(count(texts[counts.length]!));
      }

      if (counts.length < texts.length) return false;

      resolve(counts);

      return true;
    });
  });
}

/** The default client counter. Never rejects. */
export const countTokensInBackground: TextTokenCounter = async (texts) => {
  if (texts.length === 0) return [];

  const loaded = await loadTokenizer();

  return countInIdleSlices(texts, loaded?.estimateTokenCountSync ?? approximateTokenCount);
};
