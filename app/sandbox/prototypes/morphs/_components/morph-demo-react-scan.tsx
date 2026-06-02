"use client";

import { scan, setOptions } from "react-scan";
import { useEffect } from "react";

const SCAN_SAFE_AREA_BASE = {
  bottom: 96,
  left: 16,
  top: 72,
} as const;

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
        right: 300,
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
        right: debugPanelExpanded ? 300 : 52,
      },
    });
  }, [debugPanelExpanded]);

  return null;
}
