export type DeviceTier = "mobile" | "tablet" | "desktop";

export function getDeviceTier(): DeviceTier {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = navigator.maxTouchPoints > 1;
  const isTablet = /ipad|tablet|playbook|silk/.test(ua);
  const isMobileUa = /android|iphone|ipod|iemobile|mobile/.test(ua);

  if (isTablet || (hasTouch && !isMobileUa && /macintosh/.test(ua))) {
    return "tablet";
  }
  if (isMobileUa) {
    return "mobile";
  }

  return "desktop";
}

/** Tuned for ritual surface (higher FPS than Introspection welcome defaults). */
export function getMemoryIngestTierDefaults(tier: DeviceTier): {
  count: number;
  targetFps: number;
  pointSize: number;
  pixelRatioCap: number;
} {
  switch (tier) {
    case "mobile":
      return { count: 18_000, targetFps: 55, pointSize: 0.014, pixelRatioCap: 1.25 };
    case "tablet":
      return { count: 28_000, targetFps: 55, pointSize: 0.014, pixelRatioCap: 1.35 };
    default:
      return { count: 56_000, targetFps: 60, pointSize: 0.014, pixelRatioCap: 2 };
  }
}
