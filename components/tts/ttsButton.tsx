"use client";

import { Button } from "@heroui/button";
import { Volume2, X } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Loader } from "../third-party/ai-elements/loader";
import { glass } from "../design-system/primitives";

import { useTTSContext } from "@/lib/context/tts-context";
import { getSettings } from "@/lib/user-settings";
import { splitTextIntoSegments } from "@/lib/tts/token-calculator";
import { cn } from "@/lib/utils";

export function TTSButton({ text, iconOnly }: { text: string; iconOnly?: boolean }) {
  const { speak, stop, play, status, currentText } = useTTSContext();

  const textToPlay = useMemo(() => {
    const { ttsWholeMessage } = getSettings();

    return ttsWholeMessage ? text : (splitTextIntoSegments(text, "paragraph")[0] ?? text);
  }, [text]);

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

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const showOverlay = status !== "ready" && isThisClip;

  return (
    <>
      <Button
        aria-busy={status === "processing" && isThisClip}
        className="text-accent hover:scale-110 border touch-none"
        isDisabled={status === "processing" && isThisClip}
        isIconOnly={iconOnly}
        size="sm"
        tabIndex={-1}
        variant="ghost"
        onPress={handleSpeak}
      >
        {status === "processing" && isThisClip ? (
          <Loader className="w-4 h-4 mr-1 shrink-0" />
        ) : (
          <Volume2 className="w-4 h-4 mr-1" />
        )}
        {iconOnly ? null : status === "processing" && isThisClip ? "Loading…" : "Play Audio"}
      </Button>
      <div
        className={cn(
          glass(),
          "absolute top-10 md:top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2 rounded-xl transition-opacity",
          showOverlay ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
        )}
      >
        {status === "processing" && isThisClip && (
          <div className="flex items-center gap-2 shrink-0">
            <Loader className="w-5 h-5 shrink-0" />
            <span className="text-sm text-foreground">Loading audio…</span>
          </div>
        )}
        {status !== "processing" && status !== "ready" && (
          <div className="flex items-center gap-1 shrink-0">
            <Button isIconOnly size="sm" variant="ghost" aria-label="Stop" onPress={handleStop}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
