"use client";

/**
 * Throttled theme hook. Uses the root-level ThrottledThemeProvider;
 * all theme toggles go through it and are capped at once per second.
 */
export { useThrottledTheme } from "@/lib/theme/ThrottledThemeProvider";
