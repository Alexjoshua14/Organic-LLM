"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

/**
 * Dev-only, opt-in: `?reactScan=1` on the memory-ingest thread URL loads React Scan
 * (no npm dependency). See prototype README for perf workflow.
 */
export function MemoryIngestReactScan() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const q = new URLSearchParams(window.location.search);

      setEnabled(q.get("reactScan") === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  if (!enabled) return null;

  return (
    <Script src="https://unpkg.com/react-scan/dist/auto.global.js" strategy="afterInteractive" />
  );
}
