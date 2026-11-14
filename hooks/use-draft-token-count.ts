"use client";

import type { TextTokenCounter } from "@/lib/chat/context-budget";

import { useEffect, useState } from "react";

import { countTokensInBackground } from "@/lib/chat/background-token-counter";
import { approximateDraftTokens, draftTokenText } from "@/lib/chat/context-budget";

/**
 * Tokens the draft adds on send, counted in the background. Shows the last exact count while
 * the next one is pending, and an approximation (about four characters a token) until the
 * first arrives, so a keystroke never waits on the tokenizer.
 */
export function useDraftTokenCount(
  draftText: string,
  countTokens: TextTokenCounter = countTokensInBackground
): number {
  const text = draftTokenText(draftText);
  const [counted, setCounted] = useState<number | null>(null);

  // A cleared draft drops its count, so the next draft doesn't start from a stale one.
  if (!text && counted !== null) setCounted(null);

  useEffect(() => {
    if (!text) return;

    let current = true;

    void countTokens([text]).then(([tokens]) => {
      if (current && tokens !== undefined) setCounted(tokens);
    });

    return () => {
      current = false;
    };
  }, [countTokens, text]);

  if (!text) return 0;

  return counted ?? approximateDraftTokens(draftText);
}
