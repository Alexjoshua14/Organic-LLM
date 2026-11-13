"use client";

import { useEffect, useState } from "react";

import { isTokenizerReady, prepareTokenizer } from "@/lib/chat/context-budget";
import { runInIdleSlices } from "@/lib/idle-work";

/**
 * Whether token counts can be exact yet. Once `needed`, builds the tokenizer (over 100 ms) when
 * the browser is idle, so a page where nothing is typed never pays for it.
 */
export function useTokenizerReady(needed: boolean): boolean {
  const [built, setBuilt] = useState(false);

  useEffect(() => {
    if (!needed || built) return;

    return runInIdleSlices(() => {
      prepareTokenizer();
      setBuilt(true);

      return true;
    });
  }, [built, needed]);

  // Another caller may have built it already (the thread count does).
  return built || (needed && isTokenizerReady());
}
