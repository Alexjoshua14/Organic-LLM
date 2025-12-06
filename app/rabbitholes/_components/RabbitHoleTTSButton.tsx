"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@heroui/button";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { getAudioForNode, saveAudioForNode } from "../_lib/audioStorage";
import { cn } from "@/lib/utils";

interface RabbitHoleTTSButtonProps {
  nodeId: string;
  text: string;
  className?: string;
}

type TTSResponse = {
  data: {
    uint8ArrayData: Record<number, number>;
    mediaType: string;
    format: "mp3" | "ogg" | "wav";
  };
};

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}

export function RabbitHoleTTSButton({
  nodeId,
  text,
  className,
}: RabbitHoleTTSButtonProps) {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check for existing audio on mount
  useEffect(() => {
    getAudioForNode(nodeId).then((url) => {
      if (url) {
        setAudioUrl(url);
      }
    });
  }, [nodeId]);

  const handlePlay = useCallback(async () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    // Generate new audio
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // Check IndexedDB first
      const existingUrl = await getAudioForNode(nodeId);
      if (existingUrl) {
        setAudioUrl(existingUrl);
        setLoading(false);
        if (audioRef.current) {
          audioRef.current.src = existingUrl;
          audioRef.current.play();
          setIsPlaying(true);
        }
        return;
      }

      // Generate new audio
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model: "eleven_flash_v2_5",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate speech");
      }

      const data = (await res.json()) as TTSResponse;
      const blob = uint8ArrayToBlob(data.data.uint8ArrayData);
      const uint8Array = new Uint8Array(Object.values(data.data.uint8ArrayData));

      // Save to IndexedDB
      const url = await saveAudioForNode(nodeId, uint8Array);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setLoading(false);
    }
  }, [nodeId, text, audioUrl, loading]);

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        onPress={isPlaying ? handlePause : handlePlay}
        isDisabled={loading}
        className={cn(
          "text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]",
          className,
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </Button>
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />
    </>
  );
}

