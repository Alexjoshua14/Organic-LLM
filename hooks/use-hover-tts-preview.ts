"use client";

import { useCallback, useRef } from "react";

import { useTTSOptional } from "@/lib/context/tts-context";

const HOVER_DELAY_MS = 400;
const PREVIEW_WORD_LIMIT = 80;

export function truncatePreviewText(text: string, wordLimit = PREVIEW_WORD_LIMIT): string {
  const words = text.trim().split(/\s+/);

  if (words.length <= wordLimit) return text.trim();

  return `${words.slice(0, wordLimit).join(" ")}…`;
}

export function useHoverTtsPreview(artifactId: string) {
  const tts = useTTSOptional();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearTimer();
    if (activeRef.current) {
      tts?.stop();
      activeRef.current = false;
    }
  }, [clearTimer, tts]);

  const startPreview = useCallback(
    (text: string) => {
      if (!tts) return;

      clearTimer();
      timerRef.current = setTimeout(() => {
        tts.stop();
        tts.speak(truncatePreviewText(text));
        activeRef.current = true;
      }, HOVER_DELAY_MS);
    },
    [clearTimer, tts]
  );

  const toggleTapPreview = useCallback(
    (text: string) => {
      if (!tts) return;

      if (activeRef.current) {
        stopPreview();

        return;
      }

      tts.speak(truncatePreviewText(text));
      activeRef.current = true;
    },
    [stopPreview, tts]
  );

  return {
    artifactId,
    onPointerEnter: (text: string) => startPreview(text),
    onPointerLeave: stopPreview,
    onTap: (text: string) => toggleTapPreview(text),
  };
}
