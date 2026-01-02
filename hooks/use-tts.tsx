
import { useRef, useState, useCallback, useMemo } from "react";
import { AlignmentData, AudioStreamChunkSchema } from "@/lib/schemas/tts";
import { createLogger } from "@/lib/logger";
import { mergeAlignments, processAudioChunk, processAudioStream, waitForSourceBuffer, decodeAudioBase64 } from "@/lib/llm/tts/helpers";

// Create a logger instance for this hook file
const logger = createLogger("hooks/use-tts.tsx");

/**
 * Check if MediaSource API is supported in this browser
 * MediaSource is not well-supported on iOS Safari and some mobile browsers
 */
function isMediaSourceSupported(): boolean {
  return typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");
}

/**
 * Custom React hook to handle Text-to-Speech (TTS) streaming audio, playback control,
 * alignment processing, and state management.
 */
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
  // Ref for maintaining the MediaSource instance
  const mediaSourceRef = useRef<MediaSource | null>(null);
  // Ref for a possible time update interval (not used directly)
  const timeUpdateIntervalRef = useRef<number | null>(null);

  // Status of TTS playback/processing lifecycle
  const [status, setStatus] = useState<"ready" | "processing" | "readyToPlay" | "playing" | "paused" | "error" | "complete">("ready");
  // Total audio duration (in seconds)
  const [duration, setDuration] = useState<number | null>(null);
  // Current playback time (in seconds)
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  // Array accumulating all alignment chunks as they are streamed
  const [allAlignments, setAllAlignments] = useState<Array<{ alignment?: AlignmentData; normalizedAlignment?: AlignmentData }>>([]);

  // Memoized merged alignment, built from all received alignment chunks
  const mergedAlignment = useMemo(() => {
    if (allAlignments.length === 0) return null;
    return mergeAlignments(allAlignments);
  }, [allAlignments]);

  // Set of current character indices being spoken at the current time
  const currentCharacterIndices = useMemo(() => {
    if (!mergedAlignment || currentTime === null) return new Set<number>();

    // Prefer normalized alignment for better accuracy if available
    const alignment = mergedAlignment.normalizedAlignment || mergedAlignment.alignment;
    if (!alignment) return new Set<number>();

    const indices = new Set<number>();

    // Check all alignment intervals to find which indices are currently active
    for (let i = 0; i < alignment.characterStartTimesSeconds.length; i++) {
      const startTime = alignment.characterStartTimesSeconds[i];
      const endTime = alignment.characterEndTimesSeconds[i];

      if (currentTime >= startTime && currentTime <= endTime) {
        indices.add(i);
      }
    }

    return indices;
  }, [mergedAlignment, currentTime]);

  /**
   * Callback triggered when enough audio is buffered for playback.
   * Handles updating state and starting playback (autoplay), and ensures proper UI controls.
   */
  const onReadyToPlay = useCallback(async () => {
    try {
      setStatus('readyToPlay');
      onStatusChange?.('readyToPlay');
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
  }, []);

  const close = useCallback(async () => {
    // Cleanup: abort stream, clear MediaSource, remove audio URL, reset state.
    // Pause audio if playing
    if (audioRef?.current) {
      try {
        audioRef.current.pause();
      } catch (e) {
        // Ignore pause errors
      }

      // Remove event listeners if any (in case you attached some outside React effect)
      // Optionally: audioRef.current.src = ''
      // Revoke object URL if present
      const src = audioRef.current.src;
      if (src && src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
      audioRef.current.src = '';
      audioRef.current.load();
    }

    // Close MediaSource if present
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
      try {
        mediaSourceRef.current.endOfStream();
      } catch (e) {
        // ignore
      }
    }
    mediaSourceRef.current = null;

    // Reset states
    setAllAlignments([]);
    setStatus("ready");
    setDuration(0);
    setCurrentTime(0);

    // Optionally: abort fetch controller or streaming, if implemented elsewhere

  }, [])

  /**
   * Set up audio element event listeners (shared between MediaSource and blob approaches)
   */
  const setupAudioEventListeners = useCallback((audio: HTMLAudioElement) => {
    // Duration update event
    audio.addEventListener("durationchange", () => {
      onDurationChange?.(audio.duration || 0);
      setDuration(audio.duration || 0);
      logger.log("streamAudio", `Duration changed: ${audio.duration}`);
    });

    // Time update event (fires during playback)
    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    });

    // When playback starts
    audio.addEventListener("play", () => {
      setStatus("playing");
      onStatusChange?.("playing");
    });

    // When playback is paused
    audio.addEventListener("pause", () => {
      setStatus("paused");
      onStatusChange?.("paused");
    });

    // When playback ends (audio fully played)
    audio.addEventListener("ended", () => {
      setStatus("complete");
      onStatusChange?.("ready");
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    });

    // Playback or loading error
    audio.addEventListener("error", (e) => {
      setStatus("error");
      onStatusChange?.("error");
      logger.error("streamAudio", `Audio error: ${e}`);
    });
  }, [onDurationChange, onTimeUpdate, onStatusChange]);

  /**
   * Process alignment data from a chunk (shared between both approaches)
   */
  const processChunkAlignment = useCallback((chunk: { alignment?: AlignmentData; normalizedAlignment?: AlignmentData }) => {
    if (chunk.alignment || chunk.normalizedAlignment) {
      const alignmentData = {
        alignment: chunk.alignment,
        normalizedAlignment: chunk.normalizedAlignment,
      };
      onAlignment?.(alignmentData);
      setAllAlignments((prev) => [...prev, alignmentData]);
    }
  }, [onAlignment]);

  /**
   * Unified stream audio function that handles both MediaSource and blob-based approaches
   */
  const streamAudio = useCallback(async ({ text, processText = true }: { text: string, processText?: boolean }) => {
    // Reset alignments for new stream
    setAllAlignments([]);

    if (!audioRef?.current) {
      logger.error("streamAudio", "No audio ref");
      return;
    }

    const audio = audioRef.current;
    const useMediaSource = isMediaSourceSupported();

    // Cleanup old object URLs if any to prevent memory leaks
    const oldSrc = audio.src;
    if (oldSrc && oldSrc.startsWith('blob:')) {
      URL.revokeObjectURL(oldSrc);
    }

    // Set up event listeners (shared)
    setupAudioEventListeners(audio);

    // Make TTS request to backend API (shared)
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
    });

    if (!res.body) {
      logger.error("streamAudio", "No response body");
      setStatus("error");
      onStatusChange?.("error");
      return;
    }

    setStatus("processing");
    onStatusChange?.("processing");

    if (useMediaSource) {
      // MediaSource path: stream chunks directly to SourceBuffer
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      const blobUrl = URL.createObjectURL(mediaSource);
      audio.src = blobUrl;

      mediaSource.addEventListener("sourceopen", async () => {
        const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        const reader = res.body!.getReader();

        const callbacks = {
          onAlignment,
          setAllAlignments,
          onReadyToPlay
        };

        const remainingBuffer = await processAudioStream(reader, sourceBuffer, callbacks);

        if (remainingBuffer.trim()) {
          try {
            const chunk = AudioStreamChunkSchema.parse(JSON.parse(remainingBuffer));
            await processAudioChunk(chunk, sourceBuffer, callbacks);
          } catch (err) {
            logger.error("streamAudio", `Error parsing final chunk: ${err}`);
          }
        }

        await waitForSourceBuffer(sourceBuffer);
        mediaSource.endOfStream();
      });
    } else {
      // Blob path: collect all chunks, then create blob
      logger.log("streamAudio", "Using blob fallback (MediaSource not supported)");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const audioChunks: Uint8Array[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = AudioStreamChunkSchema.parse(JSON.parse(line));
            processChunkAlignment(chunk);

            if (chunk.audioBase64) {
              const audioBytes = decodeAudioBase64(chunk.audioBase64);
              audioChunks.push(audioBytes);
            }
          } catch (err) {
            logger.error("streamAudio", `Error parsing chunk: ${err}`);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = AudioStreamChunkSchema.parse(JSON.parse(buffer));
          processChunkAlignment(chunk);
          if (chunk.audioBase64) {
            const audioBytes = decodeAudioBase64(chunk.audioBase64);
            audioChunks.push(audioBytes);
          }
        } catch (err) {
          logger.error("streamAudio", `Error parsing final chunk: ${err}`);
        }
      }

      // Combine chunks into blob
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedAudio = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([combinedAudio], { type: "audio/mpeg" });
      const blobUrl = URL.createObjectURL(blob);
      audio.src = blobUrl;

      // Wait for metadata to load
      await new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          audio.removeEventListener("loadedmetadata", onLoadedMetadata);
          audio.removeEventListener("error", onError);
          resolve();
        };
        const onError = (e: Event) => {
          audio.removeEventListener("loadedmetadata", onLoadedMetadata);
          audio.removeEventListener("error", onError);
          reject(e);
        };
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("error", onError);
        audio.load();
      });

      setStatus("readyToPlay");
      onStatusChange?.("readyToPlay");
      onDurationChange?.(audio.duration || 0);
      setDuration(audio.duration || 0);

      if (autoplay) {
        await audio.play();
      }
    }
  }, [audioRef, autoplay, onAlignment, onStatusChange, onDurationChange, onTimeUpdate, setupAudioEventListeners, processChunkAlignment]);

  // ---- Media Playback Controls ----

  /**
   * Play the audio if ready (wrapper for audio element play, with logging)
   */
  const play = useCallback(() => {
    logger.log("play", "Attempting to play audio");
    if (audioRef?.current) {
      audioRef.current.play().catch(err => {
        logger.error("play", `Error playing: ${err}`);
      });
    }
  }, []);

  /**
   * Pause the audio (wrapper for audio element pause, with logging)
   */
  const pause = useCallback(() => {
    logger.log("pause", "Attempting to pause audio");
    if (audioRef?.current) {
      audioRef.current.pause();
    }
  }, []);

  /**
   * Stop playback: pause, reset to start, set status to "ready"
   */
  const stop = useCallback(() => {
    logger.log("stop", "Attempting to stop audio");
    if (audioRef?.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      onStatusChange?.("ready");
    }
  }, [onStatusChange]);

  /**
   * Seek to a certain time (in seconds) in the audio, clamped to valid bounds
   */
  const seek = useCallback((time: number) => {
    if (audioRef?.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    }
  }, []);

  // ---- API: Return all controls and state for use in TTS components ----
  return {
    // Expose TTS controls, audio state, and alignment data for use in consuming components
    streamAudio,                   // Function to start TTS streaming for a new text
    status,                        // Current playback/processing status
    play,                          // Play audio
    pause,                         // Pause audio
    stop,                          // Stop (pause + reset to beginning)
    seek,                          // Seek to specific time
    close,                         // Close and clean up audio/MediaSource
    duration,                      // Total audio duration (seconds)
    currentTime,                   // Current playback time (seconds)
    allAlignments,                 // All accumulated alignment data
    mergedAlignment,               // Alignment merged from all chunks
    currentCharacterIndices,       // Current character indices being spoken (for highlighting)
  };
}

