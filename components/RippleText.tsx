/**
 * RippleText - Streaming text with color wave effect
 * Characters transition from highlight color to base color as they appear
 * 
 * Accepts raw text directly (like from AI SDK). Tracks leading edge internally by detecting new content.
 * 
 * Example usage:
 * ```tsx
 * // Direct usage (no buffer)
 * <RippleText text={aiStreamText} isStreaming={isStreaming} />
 * ```
 */

import { useRef, useEffect, useState } from "react";
import { useSimulateStream } from "@/hooks/use-simulate-stream";

interface RippleTextProps {
  latestMessage: boolean;
  text: string;
  isStreaming?: boolean;
  highlightColor?: string;
  transitionDuration?: number; // Duration in milliseconds
}

export function RippleText({
  text,
  highlightColor = "var(--destructive)", // Warm amber/orange from design tokens
  latestMessage,
  transitionDuration = 150,
}: RippleTextProps) {
  const prevIndexRef = useRef(0);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const [shouldPlay, setShouldPlay] = useState(false);

  const { revealedIndex, isStreaming } = useSimulateStream({
    sourceText: text,
    chunkMode: "character",
    speed: 5,
    isPlaying: shouldPlay,
    shouldLoop: false,
  });

  useEffect(() => {
    if (latestMessage) {
      setShouldPlay(true);
    }
  }, [latestMessage]);

  // Detect new content and highlight leading edge
  useEffect(() => {
    if (isStreaming && revealedIndex > prevIndexRef.current) {
      // New content arrived - highlight all new characters
      // Store the starting index of new content
      const newStartIndex = prevIndexRef.current;
      setHighlightedIndex(newStartIndex);

      // Remove highlight after transition duration
      const timer = setTimeout(() => {
        setHighlightedIndex(null);
      }, transitionDuration);

      prevIndexRef.current = revealedIndex;
      return () => clearTimeout(timer);
    } else if (!isStreaming) {
      // Streaming stopped - clear any highlights
      setHighlightedIndex(null);
    }
    if (!isStreaming || revealedIndex <= prevIndexRef.current) {
      prevIndexRef.current = revealedIndex;
    }
  }, [revealedIndex, isStreaming, transitionDuration]);

  // Split text into characters for highlighting
  // Use full text so layout is correct, but only show up to revealedIndex
  const characters = text.split("");

  return (
    <p>
      {characters.map((char, idx) => {
        // Determine character state:
        // - Unrevealed: transparent (but takes up space for layout)
        // - In highlight range: highlight color
        // - Previously revealed: default color
        const isRevealed = idx < revealedIndex;
        const isHighlighted = isStreaming && highlightedIndex !== null && idx >= highlightedIndex && idx < revealedIndex;

        let color: string;
        if (!isRevealed) {
          color = 'transparent';
        } else if (isHighlighted) {
          color = highlightColor;
        } else {
          color = 'inherit'; // Use default text color
        }

        return (
          <span
            key={idx}
            style={{
              color,
              transition: `color ${transitionDuration}ms ease-out`,
            }}
          >
            {char}
          </span>
        );
      })}
    </p>
  );
}

