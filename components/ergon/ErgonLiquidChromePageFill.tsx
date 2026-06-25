"use client";

import { useErgonLiquidChrome } from "@/hooks/use-ergon-liquid-chrome";

/** SSR-seeded fixed gradient; hides when liquid chrome is toggled off without refresh. */
export function ErgonLiquidChromePageFill() {
  const enabled = useErgonLiquidChrome();

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="liquid-chrome-page-fill pointer-events-none fixed inset-0 z-0"
    />
  );
}
