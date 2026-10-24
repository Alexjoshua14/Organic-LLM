"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";

/** Delay before the latest choice is applied to next-themes (document class, storage). */
const DEBOUNCE_MS = 500;

type ThrottledThemeValue = ReturnType<typeof useTheme>;

const ThrottledThemeContext = createContext<ThrottledThemeValue | null>(null);

/**
 * Root-level debounce for applying theme changes. Wrap the app (inside next-themes)
 * so every setTheme call updates the exposed `theme` immediately for UI, while the
 * underlying next-themes update runs only after DEBOUNCE_MS without another change.
 */
export function ThrottledThemeProvider({ children }: { children: ReactNode }) {
  const nextTheme = useTheme();
  const [pendingTheme, setPendingTheme] = useState<string | undefined>(undefined);
  const pendingRef = useRef<string | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounceTimer = useCallback(() => {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearDebounceTimer();
    },
    [clearDebounceTimer]
  );

  const setTheme = useCallback<ThrottledThemeValue["setTheme"]>(
    (value) => {
      const base = pendingTheme ?? nextTheme.theme ?? "system";
      const resolved = typeof value === "function" ? value(base) : value;

      pendingRef.current = resolved;
      setPendingTheme(resolved);
      clearDebounceTimer();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        const next = pendingRef.current;

        if (next != null) {
          nextTheme.setTheme(next);
        }
        pendingRef.current = undefined;
        setPendingTheme(undefined);
      }, DEBOUNCE_MS);
    },
    [nextTheme.setTheme, nextTheme.theme, pendingTheme, clearDebounceTimer]
  );

  const value = useMemo<ThrottledThemeValue>(
    () => ({
      ...nextTheme,
      theme: pendingTheme ?? nextTheme.theme,
      setTheme,
    }),
    [nextTheme, pendingTheme, setTheme]
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
