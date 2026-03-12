"use client";

import { Button } from "@heroui/button";
import { Volume2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { createLogger } from "../../lib/logger";
import { Loader } from "../third-party/ai-elements/loader";
import { glass } from "../design-system/primitives";
import { useTTS } from "@/hooks/use-tts";
import { getSettings } from "@/lib/user-settings";
import { splitTextIntoSegments } from "@/lib/tts/token-calculator";

const logger = createLogger("components/tts/ttsButton.tsx");

type TTSResponse = {
  data: {
    uint8ArrayData: Record<number, number>; // {0:255,1:243,...}
    mediaType: string; // "audio/mpeg"
    format: "mp3" | "ogg" | "wav";
  };
};

type ModelSelection =
  | "gpt-4o-mini-tts"
  | "eleven_multilingual_v2"
  | "eleven_flash_v2_5";

declare global {
  var clearAudio: (() => void) | null;
}

export function TTSButton({
  text,
  iconOnly,
}: {
  text: string;
  iconOnly?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const { streamAudio, status, play, close } = useTTS({ audioRef, autoplay: true })

  const handleSpeak = useCallback(() => {
    if (status === 'processing' || status === 'playing') {
      return;
    } else if (status === 'complete' || status == 'readyToPlay' || status == 'paused') {
      play();
    }

    const { ttsWholeMessage } = getSettings();
    const textToPlay = ttsWholeMessage
      ? text
      : (splitTextIntoSegments(text, "paragraph")[0] ?? text);
    streamAudio({ text: textToPlay });
  }, [text, status, streamAudio, play]);


  const clearAudio = useCallback(() => {
    close()
  }, []);

  return (
    <>
      <Button
        className="text-accent hover:scale-110 border touch-none"
        isIconOnly={iconOnly}
        size="sm"
        variant="ghost"
        onPress={handleSpeak}
        isDisabled={status === "processing"}
        aria-busy={status === "processing"}
        tabIndex={-1}
      >
        {status === "processing" ? (
          <Loader className="w-4 h-4 mr-1 shrink-0" />
        ) : (
          <Volume2 className="w-4 h-4 mr-1" />
        )}
        {iconOnly ? null : status === "processing" ? "Loading…" : "Play Audio"}
      </Button>
      <div
        className={`${glass()} absolute top-10 md:top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2 rounded-xl ${status === 'ready' ? 'hidden' : ''}`}
      >
        {status === 'processing' ? (
          <>
            <Loader className="w-5 h-5 shrink-0" />
            <span className="text-sm text-foreground">Loading audio…</span>
          </>
        ) : (
          <>
            <audio
              ref={audioRef}
              autoPlay
              controls
              className={`${glass()} rounded-xl p-1 min-w-20`}
            />
            <Button isIconOnly size="sm" onPress={clearAudio}>
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>) {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));

  return new Blob([uint8Array], { type: "audio/mpeg" });
}
