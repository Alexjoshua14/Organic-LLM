"use client";

import { ThemeProvider } from "next-themes";

/** Applies the saved theme before either the startup surface or session tree paints. */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
