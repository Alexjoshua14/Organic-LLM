"use client";

import { useEffect, useRef } from "react";

import { DEFAULT_FONT_ID, getFontById, BUNDLED_FONT_IDS } from "@/config/font-options";
import { getSettings, setSettings } from "@/lib/user-settings";

const GEIST_CSS_URL = "https://geistfont.vercel.app/geist.css";
const GOOGLE_FONTS_BASE = "https://fonts.googleapis.com/css2";

function buildGoogleFontUrl(family: string): string {
  const encoded = family.replace(/ /g, "+");

  return `${GOOGLE_FONTS_BASE}?family=${encoded}:wght@300;400;500;600;700&display=swap`;
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const linkRef = useRef<HTMLLinkElement | null>(null);

  const applyStoredFont = () => {
    const stored = getSettings().fontId ?? DEFAULT_FONT_ID;
    const font = getFontById(stored);

    if (!font) return;

    if (linkRef.current?.parentNode) {
      linkRef.current.parentNode.removeChild(linkRef.current);
      linkRef.current = null;
    }
    document.body.classList.remove(
      "font-theme-satoshi",
      "font-theme-inter",
      "font-theme-commissioner"
    );
    document.body.classList.remove("font-sans");
    document.body.style.fontFamily = "";

    if (font.id === "system") {
      document.body.style.fontFamily =
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

      return;
    }
    if (BUNDLED_FONT_IDS.includes(font.id as (typeof BUNDLED_FONT_IDS)[number])) {
      document.body.classList.add(`font-theme-${font.id}`);

      return;
    }
    if (font.id === "geist") {
      const link = document.createElement("link");

      link.rel = "stylesheet";
      link.href = GEIST_CSS_URL;
      link.setAttribute("data-font-provider", "geist");
      document.head.appendChild(link);
      linkRef.current = link;
      document.body.style.fontFamily = "'Geist', 'Geist Sans', system-ui, sans-serif";

      return;
    }
    if (font.googleId) {
      const link = document.createElement("link");

      link.rel = "stylesheet";
      link.href = buildGoogleFontUrl(font.googleId);
      link.setAttribute("data-font-provider", "google");
      document.head.appendChild(link);
      linkRef.current = link;
      document.body.style.fontFamily = `'${font.googleId.replace(/'/g, "\\'")}', sans-serif`;
    }
  };

  useEffect(() => {
    applyStoredFont();
  }, []);

  // Listen for font change (same-tab settings update)
  useEffect(() => {
    const handler = () => applyStoredFont();

    window.addEventListener(FONT_CHANGE_EVENT, handler);

    return () => window.removeEventListener(FONT_CHANGE_EVENT, handler);
  }, []);

  // Listen for storage changes (e.g. from another tab)
  useEffect(() => {
    const handler = () => applyStoredFont();

    window.addEventListener("storage", handler);

    return () => window.removeEventListener("storage", handler);
  }, []);

  return <>{children}</>;
}

export const FONT_CHANGE_EVENT = "organic-llm-font-change";

/** Call after user changes font in settings. Persists to localStorage; dispatches event so UI updates. */
export function applyFontPreference(fontId: string) {
  setSettings({ fontId });
  window.dispatchEvent(new CustomEvent(FONT_CHANGE_EVENT, { detail: fontId }));
}
