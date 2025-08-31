'use client'

import { Button } from "@heroui/button";
import { Volume2 } from "lucide-react";
import { useState } from "react";

type TTSResponse = {
  data: {
    uint8ArrayData: Record<number, number>; // {0:255,1:243,...}
    mediaType: string; // "audio/mpeg"
    format: "mp3" | "ogg" | "wav";
  };
};

export function TTSButton({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSpeak() {
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
        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        onPress={handleSpeak}
      >
        <Volume2 className="w-4 h-4 mr-1" />
        Play Audio
      </Button>
      {url &&
        <div >
          <audio autoPlay src={url} controls className="absolute top-4 left-1/2 -translate-x-1/2 backdrop-blur-sm rounded-lg" />
        </div>
      }
    </>
  )
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>) {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}