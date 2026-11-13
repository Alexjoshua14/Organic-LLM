"use client";

import { useEffect, useState } from "react";

import { prepareTokenizer } from "@/lib/chat/context-budget";
import { runInIdleSlices } from "@/lib/idle-work";

/** Whether token counts are exact yet. Builds the tokenizer (over 100 ms) once the browser is idle. */
export function useTokenizerReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      runInIdleSlices(() => {
        prepareTokenizer();
        setReady(true);

        return true;
      }),
    []
  );

  return ready;
}
