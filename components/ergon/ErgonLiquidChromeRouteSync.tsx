"use client";

import { useLayoutEffect } from "react";

import { syncErgonSsrFillVisibility } from "@/lib/background/liquid-chrome-routes";
import { backfillErgonLiquidChromeCookieFromSettings } from "@/lib/ergon/liquid-chrome-bootstrap";
import { writeErgonLiquidChromeCookie } from "@/lib/ergon/liquid-chrome-cookie";
import { getSettings } from "@/lib/user-settings";

/** Keeps Ergon SSR fill in sync when chrome is toggled without refresh. */
export function ErgonLiquidChromeRouteSync() {
  useLayoutEffect(() => {
    const sync = () => {
      const enabled = getSettings().ergonLiquidChrome;
      syncErgonSsrFillVisibility(enabled);
      writeErgonLiquidChromeCookie(enabled);
    };

    backfillErgonLiquidChromeCookieFromSettings();
    sync();
    window.addEventListener("organic-llm-settings", sync);

    return () => window.removeEventListener("organic-llm-settings", sync);
  }, []);

  return null;
}
