"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the document tab is visible (not backgrounded).
 */
export function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  useEffect(() => {
    const handleVisibility = () => setVisible(!document.hidden);

    document.addEventListener("visibilitychange", handleVisibility);

    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return visible;
}
