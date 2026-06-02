"use client";

/**
 * Theme hook backed by ThrottledThemeProvider: `theme` reflects the latest
 * user choice immediately; the real next-themes apply is debounced (~500ms idle).
 */
export { useThrottledTheme } from "@/lib/theme/ThrottledThemeProvider";
