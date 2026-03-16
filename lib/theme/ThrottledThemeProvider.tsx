"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useTheme } from "next-themes";

/** Max one theme update per second app-wide. Prevents flashing and abuse. */
const THROTTLE_MS = 1000;
let lastAppliedAt = 0;

type ThrottledThemeValue = ReturnType<typeof useTheme>;

const ThrottledThemeContext = createContext<ThrottledThemeValue | null>(null);

/**
 * Root-level throttle for theme changes. Wrap the app (inside next-themes)
 * so every setTheme call goes through this provider and is rate-limited.
 * No button or component can toggle theme faster than once per second.
 */
export function ThrottledThemeProvider({ children }: { children: ReactNode }) {
  const nextTheme = useTheme();

  const setTheme = useCallback<ThrottledThemeValue["setTheme"]>(
    (value) => {
      const now = Date.now();

      if (now - lastAppliedAt >= THROTTLE_MS) {
        lastAppliedAt = now;
        nextTheme.setTheme(value);
      }
    },
    [nextTheme.setTheme]
  );

  const value = useMemo<ThrottledThemeValue>(
    () => ({ ...nextTheme, setTheme }),
    [nextTheme, setTheme]
  );

  return <ThrottledThemeContext.Provider value={value}>{children}</ThrottledThemeContext.Provider>;
}

export function useThrottledTheme(): ThrottledThemeValue {
  const ctx = useContext(ThrottledThemeContext);

  if (ctx == null) {
    throw new Error(
      "useThrottledTheme must be used within ThrottledThemeProvider (inside next-themes ThemeProvider)."
    );
  }

  return ctx;
}
