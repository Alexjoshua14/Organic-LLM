"use client";

import { useCallback } from "react";

import { useTTSContext } from "@/lib/context/tts-context";
import { assistantTtsTextToPlay } from "@/lib/tts/assistant-tts-text";
import { getSettings } from "@/lib/user-settings";

/**
 * Shared TTS affordance for assistant messages: respects `ttsWholeMessage` setting,
 * dedupes in-flight playback for the same clip, and resumes when already buffered.
 */
export function useAssistantTtsAction(text: string) {
  const { speak, play, status, currentText } = useTTSContext();

  const { ttsWholeMessage } = getSettings();
  const textToPlay = assistantTtsTextToPlay(text, ttsWholeMessage);

  const isThisClip = currentText === textToPlay;

  const handleSpeak = useCallback(() => {
    if (status === "processing" && isThisClip) {
      return;
    }
    if (status === "playing" && isThisClip) {
      return;
    }
    if ((status === "complete" || status === "readyToPlay" || status === "paused") && isThisClip) {
      play();

      return;
    }
    speak(textToPlay);
  }, [status, isThisClip, play, speak, textToPlay]);

  const isProcessingThisClip = status === "processing" && isThisClip;
  const showOverlay = isProcessingThisClip;

  return {
    handleSpeak,
    isProcessingThisClip,
    isThisClip,
    showOverlay,
    status,
    textToPlay,
  };
}
