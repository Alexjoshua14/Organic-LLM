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
  const [actualDuration, setActualDuration] = useState<number | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check for existing audio on mount
  useEffect(() => {
    getAudioForNode(nodeId).then((url) => {
      if (url) {
        setAudioUrl(url);
      }
    });
  }, [nodeId]);

  // Estimate duration from text (roughly 2.5 words/sec)
  useEffect(() => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words > 0) {
      const estSeconds = Math.ceil(words / 2.5);
      setEstimatedDuration(estSeconds);
    } else {
      setEstimatedDuration(null);
    }
  }, [text]);

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

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
      setActualDuration(audioRef.current.duration);
    }
  }, []);

  const formatDuration = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const playbackLabel =
    loading
      ? "Generating audio..."
      : actualDuration
        ? `Playback: ${formatDuration(actualDuration)}`
        : audioUrl
          ? "Playback: calculating..."
          : estimatedDuration
            ? `Est. playback: ${formatDuration(estimatedDuration) ?? `${estimatedDuration}s`}`
            : "Tap play to generate audio";

  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-white/70 dark:bg-[#1C1E1F]/70 border border-[#DCDDDC] dark:border-[#2A2C2D] rounded-lg px-3 py-2",
        "shadow-sm",
        className,
      )}
    >
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        onPress={isPlaying ? handlePause : handlePlay}
        isDisabled={loading}
        className="text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </Button>
      <div className="flex-1 min-w-0">
        <p className="font-satoshi text-xs text-[#5C5E5E] dark:text-[#A0A2A2] truncate">
          {playbackLabel}
        </p>
        {error && (
          <p className="font-satoshi text-[11px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        controls
        preload="metadata"
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onLoadedMetadata={handleLoadedMetadata}
        className={cn("h-8", audioUrl ? "block" : "hidden")}
      />
    </div>
  );
}

