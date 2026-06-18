"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = {
  light: "#ffffff",
  dark: "#141516",
} as const;

/**
 * Keeps `<meta name="theme-color">` in sync after mount when the user toggles
 * light/dark. Next.js renders the tags statically in the initial HTML (required
 * by iOS Safari); we only mutate existing tags here — never create new ones.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light;

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", color);
    });
  }, [resolvedTheme]);

  return null;
}
