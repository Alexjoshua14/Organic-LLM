'use client'

import { Button } from "@heroui/button";
import { Volume2 } from "lucide-react";
import { useRef, useState } from "react";

type TTSResponse = {
  data: {
    uint8ArrayData: Record<number, number>; // {0:255,1:243,...}
    mediaType: string; // "audio/mpeg"
    format: "mp3" | "ogg" | "wav";
  };
};

export function TTSButton({ text, iconOnly }: { text: string, iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [url, setURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function handleSpeak() {
    if (loading) return;
    if (url !== null) {
      console.log("URL is set already, assuming we already have generated the right audio, and avoiding extra costs while in development...")
      if (audioRef) {
        console.log("Playing audio");
        audioRef.current?.play();
        return;
      }
    }
    setLoading(true);
    setURL(null);
    setError(null);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        throw new Error("Failed to generate speech-friendly response");
      }

      const data = await res.json() as TTSResponse;

      console.log(data);

      const blob = uint8ArrayToBlob(data.data.uint8ArrayData);

      const objectURL = URL.createObjectURL(blob);
      setURL(objectURL);

    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly={iconOnly}
        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        onPress={handleSpeak}
      >
        <Volume2 className="w-4 h-4 mr-1" />
        {iconOnly ? null : "Play Audio"}
      </Button>
      {url &&
        <div >
          <audio ref={audioRef} autoPlay src={url} controls className="absolute top-4 left-1/2 -translate-x-1/2 backdrop-blur-sm rounded-lg" />
        </div>
      }
    </>
  )
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>) {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}