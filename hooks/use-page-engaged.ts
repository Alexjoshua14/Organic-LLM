"use client";

import { useEffect, useState } from "react";

/**
 * True while the page has focus (user is interacting inside Organic LLM, not the
 * browser chrome). When `enabled` is false, always returns true.
 */
export function usePageEngaged(enabled: boolean): boolean {
  const [engaged, setEngaged] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setEngaged(true);

      return;
    }

    const sync = () => {
      setEngaged(document.hasFocus() && !document.hidden);
    };

    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled]);

  return engaged;
}
