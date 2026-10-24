"use client";

import { scan, setOptions } from "react-scan";
import { useEffect, useState } from "react";

import { MORPH_DEMO_HUD_SIDE_MIN_WIDTH_PX } from "../_lib/morph-demo-layout";

const SCAN_SAFE_AREA_BASE = {
  bottom: 96,
  left: 16,
  top: 72,
} as const;

/** Keep Scan clear of the side HUD on wide viewports; narrow uses a top sheet. */
function scanSafeRight(debugPanelExpanded: boolean, sideDock: boolean): number {
  if (!sideDock) return 16;

  return debugPanelExpanded ? 300 : 52;
}

type MorphDemoReactScanProps = {
  /** When false, HUD is docked narrow — free top-right for the Scan toolbar. */
  debugPanelExpanded?: boolean;
};

/**
 * Loads [React Scan](https://github.com/aidenybai/react-scan) on this prototype only
 * (`development` only). Toolbar includes an FPS readout; `safeArea` avoids the morph HUD
 * and bottom morph button.
 */
export function MorphDemoReactScan({ debugPanelExpanded = true }: MorphDemoReactScanProps) {
  const [sideDock, setSideDock] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MORPH_DEMO_HUD_SIDE_MIN_WIDTH_PX}px)`);
    const sync = () => {
      setSideDock(mql.matches);
    };

    sync();
    mql.addEventListener("change", sync);

    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    scan({
      animationSpeed: "fast",
      enabled: true,
      showFPS: true,
      showNotificationCount: true,
      showToolbar: true,
      safeArea: {
        ...SCAN_SAFE_AREA_BASE,
        right: scanSafeRight(debugPanelExpanded, sideDock),
      },
    });

    return () => {
      setOptions({ enabled: false, showToolbar: false });
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    setOptions({
      safeArea: {
        ...SCAN_SAFE_AREA_BASE,
        right: scanSafeRight(debugPanelExpanded, sideDock),
      },
    });
  }, [debugPanelExpanded, sideDock]);

  return null;
}
