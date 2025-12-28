'use client'

import { createLogger } from "@/lib/logger"
import { Button } from "@heroui/button";
import { AudioLines, Pause, Play } from "lucide-react";
import z from "zod";
import { glass } from "../design-system/primitives";
import { useRef, useState, useEffect, useMemo, type ReactNode } from "react";

const logger = createLogger("components/tts/ttsButton-v2.tsx");


export default function TTSButtonV2({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const speech = useTTS({
    audioRef,
    onAlignment: (alignmentData) => {
      // This callback is called for each chunk that contains alignment data
      // You can use this for real-time text highlighting, karaoke effects, etc.
      if (alignmentData.normalizedAlignment) {
        logger.log("TTSButtonV2", "Normalized alignment received:", {
          characters: alignmentData.normalizedAlignment.characters,
          startTimes: alignmentData.normalizedAlignment.characterStartTimesSeconds,
          endTimes: alignmentData.normalizedAlignment.characterEndTimesSeconds,
        });
      }
      if (alignmentData.alignment) {
        logger.log("TTSButtonV2", "Original alignment received:", {
          characters: alignmentData.alignment.characters,
        });
      }
    },
  });

  // Merge all alignment chunks into one complete alignment
  const mergedAlignment = useMemo(() => {
    if (speech.allAlignments.length === 0) return null;
    return mergeAlignments(speech.allAlignments);
  }, [speech.allAlignments]);

  // Get current character indices being spoken
  const currentCharacterIndices = useMemo(() => {
    if (!mergedAlignment || speech.currentTime === null) return new Set<number>();

    // Prefer normalized alignment if available, otherwise use original alignment
    const alignment = mergedAlignment.normalizedAlignment || mergedAlignment.alignment;
    if (!alignment) return new Set<number>();

    const indices = new Set<number>();
    const currentTime = speech.currentTime;

    for (let i = 0; i < alignment.characterStartTimesSeconds.length; i++) {
      const startTime = alignment.characterStartTimesSeconds[i];
      const endTime = alignment.characterEndTimesSeconds[i];

      if (currentTime >= startTime && currentTime <= endTime) {
        indices.add(i);
      }
    }

    return indices;
  }, [mergedAlignment, speech.currentTime]);

  // Render text with highlighted characters
  const renderHighlightedText = () => {
    if (!mergedAlignment || currentCharacterIndices.size === 0) {
      return <span>{text}</span>;
    }

    // Use normalized alignment if available, otherwise original
    const alignment = mergedAlignment.normalizedAlignment || mergedAlignment.alignment;
    if (!alignment) {
      return <span>{text}</span>;
    }

    // Map character indices to text positions
    // Since alignment might have different characters than original text,
    // we'll highlight based on the alignment characters themselves
    const elements: ReactNode[] = [];

    for (let i = 0; i < alignment.characters.length; i++) {
      const char = alignment.characters[i];
      const isHighlighted = currentCharacterIndices.has(i);

      if (isHighlighted) {
        elements.push(
          <span
            key={i}
            className="bg-yellow-400 dark:bg-yellow-600 text-black dark:text-white px-0.5 rounded transition-colors duration-75"
          >
            {char}
          </span>
        );
      } else {
        elements.push(
          <span key={i} className="opacity-60">
            {char}
          </span>
        );
      }
    }

    return <span>{elements}</span>;
  };

  return (
    <div>

      <p>
        {speech.status}
      </p>
      <div className="flex flex-col gap-2 items-center text-default">

        <audio
          ref={audioRef}
          controls
          className={`w-full ${['ready', 'processing'].includes(speech.status) ? ' hidden' : ''}`}
        />
        <Button
          onPress={() => speech.streamAudio({ text })}
          className={
            `${glass()} transition-transform duration-300 active:scale-90 hover:scale-105 hover:shadow-lg`
          }
        >
          <AudioLines color="var(--accent)" className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90" />
        </Button>
        {/* <div className="flex gap-2 mt-3 items-center">
          {speech.status === 'ready' || speech.status === 'processing' ?
            <Button
              onPress={() => speech.streamAudio({ text })}
              className={
                `${glass()} transition-transform duration-300 active:scale-90 hover:scale-105 hover:shadow-lg`
              }
            >
              <AudioLines color="var(--accent)" className="transition-transform duration-150 group-hover:scale-110 group-active:scale-90" />
            </Button>
            :
            speech.status === 'playing' ?
              <>
                <Button
                  aria-label="Pause"
                  onPress={speech.pause}
                  disabled={speech.status !== "playing"}
                  className="rounded-full"
                >
                  <Pause className="w-5 h-5" />
                </Button>
                <Button
                  aria-label="Stop"
                  onPress={speech.stop}
                  className="rounded-full"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </Button>
              </>
              : <>
                <Button
                  aria-label="Play"
                  onPress={speech.play}
                  disabled={['error', 'processing'].includes(speech.status)}
                  className="rounded-full"
                >
                  <Play className="w-5 h-5" />
                </Button>
                <Button
                  aria-label="Stop"
                  onPress={speech.stop}
                  className="rounded-full"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </Button>
              </>
          }
        </div>
        <div>
          <input
            type="range"
            min={0}
            max={speech.audioRef.current?.duration ?? 0}
            step={0.01}
            value={speech.audioRef.current?.currentTime ?? 0}
            onChange={e => {
              const time = Number(e.target.value);
              speech.seek(time);
            }}
            disabled={
              !speech.audioRef.current || !speech.audioRef.current?.duration
            }
            style={{
              width: 120,
              verticalAlign: "middle",
            }}
            className=" bg-background-tertiary rounded h-2 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:border-none [&::-webkit-slider-thumb]:shadow headlessui-slider-thumb:bg-text-primary"
          />
          <span className="ml-2 text-xs tabular-nums" style={{ minWidth: 48, display: "inline-block" }}>
            {speech.audioRef.current?.currentTime && speech.audioRef.current?.duration
              ? `${speech.audioRef.current?.currentTime.toFixed(2)}/${speech.audioRef.current?.duration?.toFixed(2) ?? "0.00"}s`
              : ""}
          </span>
        </div> */}
        <div className="h-10 w-full overflow-auto">
          <div className="text-sm leading-relaxed wrap-break-word">
            {renderHighlightedText()}
          </div>
        </div>
      </div>
    </div>
  )
}

const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  characterStartTimesSeconds: z.array(z.number()),
  characterEndTimesSeconds: z.array(z.number()),
})

/**
 * Helper function to get the current character index being spoken
 * based on the current audio time and alignment data
 */
export function getCurrentCharacterIndex(
  currentTime: number,
  alignment: AlignmentData
): number | null {
  if (!alignment || !alignment.characterStartTimesSeconds || !alignment.characterEndTimesSeconds) {
    return null;
  }

  for (let i = 0; i < alignment.characterStartTimesSeconds.length; i++) {
    const startTime = alignment.characterStartTimesSeconds[i];
    const endTime = alignment.characterEndTimesSeconds[i];

    if (currentTime >= startTime && currentTime <= endTime) {
      return i;
    }
  }

  return null;
}

/**
 * Helper function to merge multiple alignment chunks into a single alignment
 * Useful when you want to combine all chunks into one complete alignment
 */
export function mergeAlignments(
  alignments: Array<{ alignment?: AlignmentData; normalizedAlignment?: AlignmentData }>
): { alignment?: AlignmentData; normalizedAlignment?: AlignmentData } | null {
  if (alignments.length === 0) return null;

  const mergedAlignment: AlignmentData = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };

  const mergedNormalized: AlignmentData = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };

  let hasAlignment = false;
  let hasNormalized = false;

  for (const chunk of alignments) {
    if (chunk.alignment) {
      mergedAlignment.characters.push(...chunk.alignment.characters);
      mergedAlignment.characterStartTimesSeconds.push(...chunk.alignment.characterStartTimesSeconds);
      mergedAlignment.characterEndTimesSeconds.push(...chunk.alignment.characterEndTimesSeconds);
      hasAlignment = true;
    }
    if (chunk.normalizedAlignment) {
      mergedNormalized.characters.push(...chunk.normalizedAlignment.characters);
      mergedNormalized.characterStartTimesSeconds.push(...chunk.normalizedAlignment.characterStartTimesSeconds);
      mergedNormalized.characterEndTimesSeconds.push(...chunk.normalizedAlignment.characterEndTimesSeconds);
      hasNormalized = true;
    }
  }

  return {
    alignment: hasAlignment ? mergedAlignment : undefined,
    normalizedAlignment: hasNormalized ? mergedNormalized : undefined,
  };
}

const AudioStreamChunkSchema = z.object({
  audioBase64: z.string(),
  alignment: AlignmentSchema.optional(),
  normalizedAlignment: AlignmentSchema.optional(),
})

import { useCallback } from "react"

export type AlignmentData = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

export function useTTS({
  onStatusChange,
  onTimeUpdate,
  onDurationChange,
  onAlignment,
  audioRef
}: {
  onStatusChange?: (status: "ready" | "processing" | "playing" | "paused" | "error" | "complete") => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onAlignment?: (alignment: { alignment?: AlignmentData; normalizedAlignment?: AlignmentData }) => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
} = {}) {
  const internalAudioRef = useRef<HTMLAudioElement | null>(audioRef?.current);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"ready" | "processing" | "playing" | "paused" | "error" | "complete">("ready")
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [allAlignments, setAllAlignments] = useState<Array<{ alignment?: AlignmentData; normalizedAlignment?: AlignmentData }>>([]);


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
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = AudioStreamChunkSchema.parse(JSON.parse(line));

            if (chunk.audioBase64) {
              // Extract and expose alignment data if present
              if (chunk.alignment || chunk.normalizedAlignment) {
                const alignmentData = {
                  alignment: chunk.alignment,
                  normalizedAlignment: chunk.normalizedAlignment,
                };

                // Call callback with alignment data
                onAlignment?.(alignmentData);

                // Accumulate all alignments
                setAllAlignments(prev => [...prev, alignmentData]);

                logger.log("streamAudio", `Alignment data received:`, {
                  hasAlignment: !!chunk.alignment,
                  hasNormalized: !!chunk.normalizedAlignment,
                  alignmentChars: chunk.alignment?.characters.length,
                  normalizedChars: chunk.normalizedAlignment?.characters.length,
                });
              }

              const audioBytes = Uint8Array.from(
                atob(chunk.audioBase64),
                c => c.charCodeAt(0)
              );

              await new Promise(resolve => {
                if (!sourceBuffer.updating) {
                  return resolve(null);
                }
                sourceBuffer.addEventListener("updateend", resolve, { once: true })
              })
              sourceBuffer.appendBuffer(audioBytes);
            }
          } catch (err) {
            logger.error("streamAudio", `Error parsing chunk: ${err}`)
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = AudioStreamChunkSchema.parse(JSON.parse(buffer));
          if (chunk.audioBase64) {
            // Extract alignment data from final chunk if present
            if (chunk.alignment || chunk.normalizedAlignment) {
              const alignmentData = {
                alignment: chunk.alignment,
                normalizedAlignment: chunk.normalizedAlignment,
              };
              onAlignment?.(alignmentData);
              setAllAlignments(prev => [...prev, alignmentData]);
            }

            const audioBytes = Uint8Array.from(
              atob(chunk.audioBase64),
              c => c.charCodeAt(0)
            );
            await new Promise(resolve => {
              if (!sourceBuffer.updating) {
                return resolve(null);
              }
              sourceBuffer.addEventListener("updateend", resolve, { once: true });
            });
            sourceBuffer.appendBuffer(audioBytes);
          }
        } catch (err) {
          logger.error("streamAudio", `Error parsing final chunk: ${err}`);
        }
      }

      // Wait for sourceBuffer to finish any pending updates
      await new Promise(resolve => {
        if (!sourceBuffer.updating) {
          return resolve(null);
        }
        sourceBuffer.addEventListener("updateend", resolve, { once: true });
      });

      // Mark end of stream
      mediaSource.endOfStream();
      audio.controls = true;

      // Autoplay
      // Wait a bit for MediaSource to be ready, then play
      try {
        await audio.play();
      } catch (err) {
        logger.error("streamAudio", `Error playing audio: ${err}`);
      }
    });
  }, [onAlignment]);


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
  };
}