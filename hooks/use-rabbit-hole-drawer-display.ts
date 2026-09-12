"use client";

import type { DrawerChatDisplayInput } from "@/lib/rabbit-holes/drawer-chat-ui-budget";
import type { MobileSheetSnap } from "@/components/rabbit-holes/mobile/MobileBottomSheet";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_FONT_PX = 14;
const DEFAULT_LINE_HEIGHT_PX = 20;

export function useRabbitHoleDrawerDisplay(
  aiBlockRef: React.RefObject<HTMLElement | null>,
  sheetSnap: MobileSheetSnap
) {
  const displayInputRef = useRef<DrawerChatDisplayInput | null>(null);
  const [revision, setRevision] = useState(0);

  const measure = useCallback(() => {
    if (typeof window === "undefined") return;

    const aiEl = aiBlockRef.current;
    const aiRect = aiEl?.getBoundingClientRect();
    const fontSizePx =
      aiEl && typeof window !== "undefined"
        ? parseFloat(window.getComputedStyle(aiEl).fontSize) || DEFAULT_FONT_PX
        : DEFAULT_FONT_PX;
    const lineHeightPx =
      aiEl && typeof window !== "undefined"
        ? parseFloat(window.getComputedStyle(aiEl).lineHeight) || DEFAULT_LINE_HEIGHT_PX
        : DEFAULT_LINE_HEIGHT_PX;

    displayInputRef.current = {
      viewportWidthPx: window.innerWidth,
      viewportHeightPx: window.innerHeight,
      sheetSnap,
      aiBlockMaxHeightPx: aiRect?.height ?? Math.round(window.innerHeight * 0.5),
      aiBlockWidthPx: aiRect?.width ?? Math.min(window.innerWidth, 480),
      fontSizePx,
      lineHeightPx,
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    setRevision((r) => r + 1);
  }, [aiBlockRef, sheetSnap]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);

    const el = aiBlockRef.current;
    const ro = el ? new ResizeObserver(() => measure()) : null;

    if (el) ro?.observe(el);

    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [aiBlockRef, measure]);

  return { displayInputRef, revision };
}
