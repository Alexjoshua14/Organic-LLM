"use client";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { useErgonLiquidChrome } from "@/hooks/use-ergon-liquid-chrome";

export function ErgonPageBackground() {
  const enabled = useErgonLiquidChrome();

  if (!enabled) return null;

  return <AdaptiveLiquidChrome dimIntensity={0.45} />;
}
