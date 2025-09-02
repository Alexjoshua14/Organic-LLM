"use client";

import { Button } from "@heroui/button";
import { Volume2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { createLogger } from "../../lib/logger";
import { Skeleton } from "../third-party/ui/skeleton";
import { Loader } from "../third-party/ai-elements/loader";

const logger = createLogger("components/tts/ttsButton.tsx");

type TTSResponse = {
  data: {
    uint8ArrayData: Record<number, number>; // {0:255,1:243,...}
    mediaType: string; // "audio/mpeg"
    format: "mp3" | "ogg" | "wav";
  };
};

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
  const [loading, setLoading] = useState(false);
  const [url, setURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleSpeak() {
    if (loading) return;
    if (url !== null) {
      logger.log(
        "handleSpeak",
        "URL is set already, assuming we already have generated the right audio, and avoiding extra costs while in development...",
      );
      if (audioRef) {
        logger.log("handleSpeak", "Playing audio");
        audioRef.current?.play();

        return;
      }
    }

    if (global.clearAudio && url === null) {
      global.clearAudio();
      global.clearAudio = null;
    }

    clearAudio();

    try {
      setLoading(true);
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate speech-friendly response");
      }

      const data = (await res.json()) as TTSResponse;

      logger.log("handleSpeak", "TTS response received:", data);

      const blob = uint8ArrayToBlob(data.data.uint8ArrayData);

      const objectURL = URL.createObjectURL(blob);

      setURL(objectURL);
      global.clearAudio = clearAudio;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }

  const clearAudio = useCallback(() => {
    audioRef.current?.pause();
    setURL(null);
    setLoading(false);
    setError(null);
  }, []);

  return (
    <>
      <Button
        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        isIconOnly={iconOnly}
        size="sm"
        variant="ghost"
        onPress={handleSpeak}
      >
        <Volume2 className="w-4 h-4 mr-1" />
        {iconOnly ? null : "Play Audio"}
      </Button>
      {(loading || url) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1">
          {url ? (
            <audio
              ref={audioRef}
              autoPlay
              controls
              className="backdrop-blur-sm rounded-lg"
              src={url ?? undefined}
            >
              <track kind="captions" />
            </audio>
          ) : (
            <Loader className="w-4 h-4" />
          )}

          <Button isIconOnly size="sm" onPress={clearAudio}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </>
  );
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>) {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));

  return new Blob([uint8Array], { type: "audio/mpeg" });
}
