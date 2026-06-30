"use client";

import type { CSSProperties, RefObject } from "react";
import type { DelphiCaptionBudget, DelphiDisplayInput } from "@/lib/memory-ingest/delphi-caption-budget";

import { useCallback, useEffect, useRef, useState } from "react";

import { getDeviceTier } from "../_lib/lens/device-tier";
import {
  getMemoryIngestDockHeightPx,
  getMemoryIngestParticleMinReservePx,
  MEMORY_INGEST_CAPTION_MARGIN_REM,
  MEMORY_INGEST_SHELL_TOP_PADDING_REM,
} from "../_lib/memory-ingest-layout";

import {
  computeCaptionAllocatedHeightPx,
  computeDelphiCaptionBudget,
  measureAvgCharWidthPx,
} from "@/lib/memory-ingest/delphi-caption-budget";

const MD_BREAKPOINT_PX = 768;

function readSafeAreaBottomPx(): number {
  if (typeof document === "undefined") return 0;

  const probe = document.createElement("div");

  probe.style.paddingBottom = "env(safe-area-inset-bottom)";
  document.body.appendChild(probe);
  const pb = parseFloat(getComputedStyle(probe).paddingBottom) || 0;

  document.body.removeChild(probe);

  return pb;
}

function readTypography(proseEl: HTMLElement | null): {
  fontSizePx: number;
  lineHeightPx: number;
  avgCharWidthPx: number;
} {
  if (!proseEl) {
    return { fontSizePx: 15, lineHeightPx: 20.625, avgCharWidthPx: 0 };
  }

  const style = getComputedStyle(proseEl);
  const fontSizePx = parseFloat(style.fontSize) || 15;
  const lineHeightPx = parseFloat(style.lineHeight) || fontSizePx * 1.375;
  const font = style.font;
  const avgCharWidthPx = font ? measureAvgCharWidthPx(font) : 0;

  return { fontSizePx, lineHeightPx, avgCharWidthPx };
}

export type UseMemoryIngestCaptionBudgetResult = {
  captionRef: RefObject<HTMLDivElement | null>;
  budget: DelphiCaptionBudget | null;
  displayInputRef: RefObject<DelphiDisplayInput | null>;
  captionStyle: CSSProperties;
};

export function useMemoryIngestCaptionBudget(): UseMemoryIngestCaptionBudgetResult {
  const captionRef = useRef<HTMLDivElement>(null);
  const displayInputRef = useRef<DelphiDisplayInput | null>(null);
  const [budget, setBudget] = useState<DelphiCaptionBudget | null>(null);
  const [captionStyle, setCaptionStyle] = useState<CSSProperties>({});

  const recompute = useCallback(() => {
    if (typeof window === "undefined") return;

    const captionEl = captionRef.current;
    const proseEl = captionEl?.querySelector(".ai-message") as HTMLElement | null;
    const rootFontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const viewportWidthPx = window.innerWidth;
    const viewportHeightPx = window.innerHeight;
    const isMdUp = viewportWidthPx >= MD_BREAKPOINT_PX;

    const captionWidthPx = captionEl?.getBoundingClientRect().width ?? viewportWidthPx - 32;
    const { fontSizePx, lineHeightPx, avgCharWidthPx } = readTypography(proseEl);

    const captionAllocatedHeightPx = computeCaptionAllocatedHeightPx({
      viewportHeightPx,
      dockHeightPx: getMemoryIngestDockHeightPx(rootFontSizePx, isMdUp),
      shellTopPaddingPx: MEMORY_INGEST_SHELL_TOP_PADDING_REM * rootFontSizePx,
      captionMarginPx: MEMORY_INGEST_CAPTION_MARGIN_REM * rootFontSizePx,
      particleMinReservePx: getMemoryIngestParticleMinReservePx(viewportHeightPx, isMdUp),
      safeAreaBottomPx: readSafeAreaBottomPx(),
    });

    const input: DelphiDisplayInput = {
      viewportWidthPx,
      viewportHeightPx,
      devicePixelRatio: window.devicePixelRatio,
      screenWidthPx: window.screen.width,
      screenHeightPx: window.screen.height,
      captionWidthPx,
      captionAllocatedHeightPx,
      fontSizePx,
      lineHeightPx,
      avgCharWidthPx: avgCharWidthPx > 0 ? avgCharWidthPx : undefined,
      userAgent: navigator.userAgent,
      deviceTier: getDeviceTier(),
      rootFontSizePx,
    };

    displayInputRef.current = input;

    const nextBudget = computeDelphiCaptionBudget(input);

    setBudget(nextBudget);
    setCaptionStyle({
      minHeight: nextBudget.visibleHeightPx,
      maxHeight: nextBudget.visibleHeightPx,
    });
  }, []);

  useEffect(() => {
    recompute();

    const captionEl = captionRef.current;

    if (!captionEl) return;

    const ro = new ResizeObserver(() => recompute());

    ro.observe(captionEl);

    window.addEventListener("resize", recompute);
    window.visualViewport?.addEventListener("resize", recompute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  return { captionRef, budget, displayInputRef, captionStyle };
}
