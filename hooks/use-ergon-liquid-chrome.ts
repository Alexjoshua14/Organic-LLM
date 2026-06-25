"use client";

import { useLayoutEffect, useState } from "react";

import { useErgonChromeSeed } from "@/components/ergon/ErgonChromeProvider";
import { backfillErgonLiquidChromeCookieFromSettings } from "@/lib/ergon/liquid-chrome-bootstrap";
import { writeErgonLiquidChromeCookie } from "@/lib/ergon/liquid-chrome-cookie";
import { getSettings } from "@/lib/user-settings";

/** Reactive Ergon liquid chrome background toggle (localStorage + organic-llm-settings event). */
export function useErgonLiquidChrome(): boolean {
  const initialEnabled = useErgonChromeSeed();
  const [enabled, setEnabled] = useState(initialEnabled);

  useLayoutEffect(() => {
    const sync = () => {
      const next = getSettings().ergonLiquidChrome;
      setEnabled(next);
      writeErgonLiquidChromeCookie(next);
    };

    backfillErgonLiquidChromeCookieFromSettings();
    sync();
    window.addEventListener("organic-llm-settings", sync);

    return () => window.removeEventListener("organic-llm-settings", sync);
  }, []);

  return enabled;
}
