
import { useRef, useState, useCallback, useMemo } from "react";
import { AlignmentData, AudioStreamChunkSchema } from "@/lib/schemas/tts";
import { createLogger } from "@/lib/logger";
import { mergeAlignments, processAudioChunk, processAudioStream, waitForSourceBuffer } from "@/lib/llm/tts/helpers";


const logger = createLogger("hooks/use-tts.tsx");


export function useTTS({
  onStatusChange,
  onTimeUpdate,
  onDurationChange,
  onAlignment,
  audioRef,
  autoplay = true,
}: {
  onStatusChange?: (status: "ready" | "processing" | "readyToPlay" | "playing" | "paused" | "error" | "complete") => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onAlignment?: (alignment: { alignment?: AlignmentData; normalizedAlignment?: AlignmentData }) => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  autoplay?: boolean;
} = {}) {
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"ready" | "processing" | "readyToPlay" | "playing" | "paused" | "error" | "complete">("ready")
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [allAlignments, setAllAlignments] = useState<Array<{ alignment?: AlignmentData; normalizedAlignment?: AlignmentData }>>([]);

  // Merge all alignment chunks into one complete alignment
  const mergedAlignment = useMemo(() => {
    if (allAlignments.length === 0) return null;
    return mergeAlignments(allAlignments);
  }, [allAlignments]);

  // Get current character indices being spoken
  const currentCharacterIndices = useMemo(() => {
    if (!mergedAlignment || currentTime === null) return new Set<number>();

    // Prefer normalized alignment if available, otherwise use original alignment
    const alignment = mergedAlignment.normalizedAlignment || mergedAlignment.alignment;
    if (!alignment) return new Set<number>();

    const indices = new Set<number>();

    for (let i = 0; i < alignment.characterStartTimesSeconds.length; i++) {
      const startTime = alignment.characterStartTimesSeconds[i];
      const endTime = alignment.characterEndTimesSeconds[i];

      if (currentTime >= startTime && currentTime <= endTime) {
        indices.add(i);
      }
    }

    return indices;
  }, [mergedAlignment, currentTime]);

  const onReadyToPlay = useCallback(async () => {

    try {
      setStatus('readyToPlay')
      onStatusChange?.('readyToPlay')
      if (audioRef?.current) {
        audioRef.current.controls = true;
        if (autoplay) {
          await audioRef.current.play();
        }
      }
      logger.log("streamAudio", `Ready to play audio, current duration of ready audio is: ${audioRef?.current?.duration}`);
    } catch (err) {
      logger.error("streamAudio", `Error playing audio early: ${err}`);
    }
  }, [audioRef])

  const streamAudio = useCallback(async ({ text, processText = true }: { text: string, processText?: boolean }) => {
    // Reset alignments for new stream
    setAllAlignments([]);

    if (!audioRef?.current) {
      logger.error("streamAudio", "No audio ref")
      return;
    }

    const audio = audioRef.current

    const oldSrc = audio.src;

    if (oldSrc && oldSrc.startsWith('blob:')) {
      URL.revokeObjectURL(oldSrc)
    }

    const mediaSource = new MediaSource()
    mediaSourceRef.current = mediaSource;

    // Set audio element's src to new blob URL from MediaSource
    const blobUrl = URL.createObjectURL(mediaSource);
    audio.src = blobUrl;

    // Hook in callback functions
    audio.addEventListener("durationchange", () => {
      onDurationChange?.(audio.duration || 0);
      setDuration(audio.duration || 0);
      logger.log("streamAudio", `Duration changed: ${audio.duration}`);
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    });

    audio.addEventListener("play", () => {
      setStatus("playing")
      onStatusChange?.("playing");
    });

    audio.addEventListener("pause", () => {
      setStatus("paused")
      onStatusChange?.("paused");
    });

    audio.addEventListener("ended", () => {
      setStatus("complete")
      onStatusChange?.("ready");
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    });

    audio.addEventListener("error", (e) => {
      setStatus("error")
      onStatusChange?.("error");
      logger.error("streamAudio", `Audio error: ${e}`);
    });


    // Begin streaming audio for TTS using MediaSource, fetch response, and decode chunks.
    mediaSource.addEventListener("sourceopen", async () => {
      setStatus("processing")
      onStatusChange?.("processing")
      const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

      const res = await fetch("/api/ai/tts-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model: "eleven_multilingual_v2",
          skipTransform: !processText,
        }),
      })

      if (!res.body) {
        logger.error("streamAudio", "No response body")
        mediaSource.endOfStream();
        onStatusChange?.("error")
        return;
      }

      const reader = res.body.getReader();
      const callbacks = {
        onAlignment,
        setAllAlignments,
        onReadyToPlay
      }
      // Process stream
      const remainingBuffer = await processAudioStream(reader, sourceBuffer, callbacks);

      // Handle remaining buffer
      if (remainingBuffer.trim()) {
        try {
          const chunk = AudioStreamChunkSchema.parse(JSON.parse(remainingBuffer));
          await processAudioChunk(chunk, sourceBuffer, callbacks);
        } catch (err) {
          logger.error("streamAudio", `Error parsing final chunk: ${err}`);
        }
      }

      // Finalize
      await waitForSourceBuffer(sourceBuffer);
      mediaSource.endOfStream();
    });
  }, [onAlignment, audioRef, autoplay]);


  // Media Playback handles
  const play = useCallback(() => {
    logger.log("play", "Attempting to play audio");
    if (audioRef?.current) {
      audioRef.current.play().catch(err => {
        logger.error("play", `Error playing: ${err}`);
      });
    }
  }, []);

  const pause = useCallback(() => {
    logger.log("pause", "Attempting to pause audio");
    if (audioRef?.current) {
      audioRef.current.pause();
    }
  }, []);

  const stop = useCallback(() => {
    logger.log("stop", "Attempting to stop audio");
    if (audioRef?.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      onStatusChange?.("ready");
    }
  }, [onStatusChange]);

  const seek = useCallback((time: number) => {
    if (audioRef?.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    }
  }, []);

  return {
    streamAudio,
    status,
    play,
    pause,
    stop,
    seek,
    duration,
    currentTime,
    allAlignments, // All accumulated alignment data
    mergedAlignment, // Merged alignment data
    currentCharacterIndices, // Current character indices being spoken
  };
}

