
import { useRef, useState, useCallback, useMemo } from "react";
import { AlignmentData, AudioStreamChunkSchema } from "@/lib/schemas/tts";
import { createLogger } from "@/lib/logger";
import { mergeAlignments, processAudioChunk, processAudioStream, waitForSourceBuffer } from "@/lib/llm/tts/helpers";

// Create a logger instance for this hook file
const logger = createLogger("hooks/use-tts.tsx");

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
   * Stream audio from TTS backend, process chunks, manage alignments, and control the MediaSource/audio lifecycle.
   * This is the core logic for fetching, decoding, and playing TTS audio streams.
   */
  const streamAudio = useCallback(async ({ text, processText = true }: { text: string, processText?: boolean }) => {
    // Reset alignments for new stream
    setAllAlignments([]);

    if (!audioRef?.current) {
      logger.error("streamAudio", "No audio ref");
      return;
    }

    const audio = audioRef.current;

    // Cleanup old object URLs if any to prevent memory leaks
    const oldSrc = audio.src;
    if (oldSrc && oldSrc.startsWith('blob:')) {
      URL.revokeObjectURL(oldSrc);
    }

    // Create a new MediaSource for this stream
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    // Set audio's source to the new MediaSource object URL
    const blobUrl = URL.createObjectURL(mediaSource);
    audio.src = blobUrl;

    // --- Audio element event listeners for state management and reporting ---

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

    // --- MediaSource streaming and TTS data handling logic ---
    mediaSource.addEventListener("sourceopen", async () => {
      setStatus("processing");
      onStatusChange?.("processing");
      // Create an MPEG audio buffer for the stream
      const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

      // Make TTS request to backend API
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
        mediaSource.endOfStream();
        onStatusChange?.("error");
        return;
      }

      // Reader for NDJSON chunked response
      const reader = res.body.getReader();
      // Callbacks for processing alignments and early play
      const callbacks = {
        onAlignment,
        setAllAlignments,
        onReadyToPlay
      };

      // Process and append each audio chunk as it's streamed from backend
      const remainingBuffer = await processAudioStream(reader, sourceBuffer, callbacks);

      // If any text left in buffer, process as a final chunk (handles incomplete responses gracefully)
      if (remainingBuffer.trim()) {
        try {
          const chunk = AudioStreamChunkSchema.parse(JSON.parse(remainingBuffer));
          await processAudioChunk(chunk, sourceBuffer, callbacks);
        } catch (err) {
          logger.error("streamAudio", `Error parsing final chunk: ${err}`);
        }
      }

      // Ensure all data has been appended before signaling end-of-stream
      await waitForSourceBuffer(sourceBuffer);
      mediaSource.endOfStream();
    });
    // Note: [onAlignment, audioRef, autoplay] in deps. If you add/remove any more props, update this!
  }, [onAlignment, audioRef, autoplay]);

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

