"use client";

import { useEffect, useState, type ReactNode } from "react";

const DEFAULT_DELAY_MS = 400;

interface DelayedContentProps {
  delayMs?: number;
  children: ReactNode;
}

/**
 * Renders nothing for delayMs, then renders children.
 * Use to avoid flashing loading UIs when operations complete quickly.
 */
export function DelayedContent({ delayMs = DEFAULT_DELAY_MS, children }: DelayedContentProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs);

    return () => clearTimeout(t);
  }, [delayMs]);

  if (!show) return null;

  return <>{children}</>;
}
