/**
 * useSimulateStream - Simple hook that simulates AI SDK streaming behavior
 *
 * Takes a full text string and gradually reveals it at a controlled rate.
 * Outputs the simple API (text + isStreaming) that prototypes can consume directly.
 *
 * Example usage:
 * ```tsx
 * const { text, isStreaming, reset } = useSimulateStream({
 *   sourceText: "Hello world",
 *   chunkMode: 'character',
 *   speed: 50,
 *   isPlaying: true,
 *   shouldLoop: false
 * });
 *
 * <TypewriterPrototype text={text} isStreaming={isStreaming} />
 * ```
 */

import { useState, useEffect, useRef } from "react";
import { StreamMode } from "../components/prototypes/types";

export interface UseSimulateStreamOptions {
  sourceText: string;
  chunkMode: StreamMode;
  speed: number; // ms per chunk
  isPlaying: boolean;
  shouldLoop?: boolean;
}

export interface UseSimulateStreamResult {
  text: string;
  isStreaming: boolean;
  reset: () => void;
}

export function useSimulateStream({
  sourceText,
  chunkMode,
  speed,
  isPlaying,
  shouldLoop = false,
}: UseSimulateStreamOptions): UseSimulateStreamResult {
  const [revealedLength, setRevealedLength] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [restartTrigger, setRestartTrigger] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const unitsRef = useRef<string[]>([]);
  const currentUnitIndexRef = useRef(0);

  // Parse text into units based on chunk mode
  const parseIntoUnits = (text: string, mode: StreamMode): string[] => {
    if (mode === "character") {
      return text.split("");
    } else if (mode === "word") {
      // Split by words, keeping spaces attached to words
      return text.split(/(\S+\s*)/g).filter((unit) => unit.trim().length > 0);
    } else if (mode === "line") {
      // Split by newlines but preserve line breaks
      return text.split(/(\n+)/).filter((unit) => unit.length > 0);
    } else if (mode === "sentence") {
      // Split by sentence delimiters
      return text.split(/([.!?]\s*)/).filter((unit) => unit.length > 0);
    }
    return [];
  };

  // Reset function
  const reset = () => {
    setRevealedLength(0);
    setIsStreaming(false);
    currentUnitIndexRef.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Trigger effect to re-run after reset
    setRestartTrigger((prev) => prev + 1);
  };

  // Parse units when sourceText or chunkMode changes
  useEffect(() => {
    unitsRef.current = parseIntoUnits(sourceText, chunkMode);
    reset();
  }, [sourceText, chunkMode]);

  // Streaming effect - reveal one chunk at a time
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPlaying) {
      setIsStreaming(false);
      return;
    }

    // Check if we've reached the end
    if (currentUnitIndexRef.current >= unitsRef.current.length) {
      setIsStreaming(false);

      // Handle looping
      if (shouldLoop && isPlaying) {
        setTimeout(() => {
          reset();
        }, 3000);
      }
      return;
    }

    // Start streaming
    setIsStreaming(true);

    // Create interval with current speed value
    intervalRef.current = setInterval(() => {
      if (currentUnitIndexRef.current < unitsRef.current.length) {
        // Reveal next unit
        currentUnitIndexRef.current++;
        // Calculate new revealed length by accumulating units up to current index
        const accumulated = unitsRef.current
          .slice(0, currentUnitIndexRef.current)
          .join("").length;
        setRevealedLength(accumulated);
      } else {
        // Reached the end
        setIsStreaming(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Handle looping
        if (shouldLoop && isPlaying) {
          setTimeout(() => {
            reset();
          }, 3000);
        }
      }
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, shouldLoop, speed, restartTrigger]);

  // Calculate displayed text from revealed length
  const text = sourceText.substring(0, revealedLength);

  return {
    text,
    isStreaming,
    reset,
  };
}
