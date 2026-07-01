"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DEFAULT_SETTLE_MS = 420;

/**
 * False briefly after pathname changes so surface hints render after navigation + layout paint.
 */
export function useFeatureHintNavigationSettled(delayMs = DEFAULT_SETTLE_MS): boolean {
  const pathname = usePathname() ?? "";
  const [settled, setSettled] = useState(true);
  const [settledPath, setSettledPath] = useState(pathname);

  useEffect(() => {
    setSettled(false);

    const timer = window.setTimeout(() => {
      setSettled(true);
      setSettledPath(pathname);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, pathname]);

  return settled && settledPath === pathname;
}
