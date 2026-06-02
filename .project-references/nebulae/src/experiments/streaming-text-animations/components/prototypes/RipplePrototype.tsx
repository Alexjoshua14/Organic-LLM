/**
 * RipplePrototype - Streaming text with color wave effect
 * Characters transition from highlight color to base color as they appear
 * 
 * Accepts raw text directly (like from AI SDK). Tracks leading edge internally by detecting new content.
 * 
 * Example usage:
 * ```tsx
 * // Direct usage (no buffer)
 * <RipplePrototype text={aiStreamText} isStreaming={isStreaming} />
 * ```
 */

import { useRef, useEffect, useState } from "react";

interface RipplePrototypeProps {
  text: string;
  isStreaming: boolean;
  highlightColor?: string;
  transitionDuration?: number; // Duration in milliseconds
}

export function RipplePrototype({
  text,
  isStreaming,
  highlightColor = "var(--color-accent-ember)", // Warm amber/orange from design tokens
  transitionDuration = 150,
}: RipplePrototypeProps) {
  const prevLengthRef = useRef(0);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  // Detect new content and highlight leading edge
  useEffect(() => {
    if (isStreaming && text.length > prevLengthRef.current) {
      // New content arrived - highlight all new characters
      // Store the starting index of new content
      const newStartIndex = prevLengthRef.current;
      setHighlightedIndex(newStartIndex);

      // Remove highlight after transition duration
      const timer = setTimeout(() => {
        setHighlightedIndex(null);
      }, transitionDuration);

      prevLengthRef.current = text.length;
      return () => clearTimeout(timer);
    } else if (!isStreaming) {
      // Streaming stopped - clear any highlights
      setHighlightedIndex(null);
    }
    if (!isStreaming || text.length <= prevLengthRef.current) {
      prevLengthRef.current = text.length;
    }
  }, [text, isStreaming, transitionDuration]);

  // Split text into characters for highlighting
  const characters = text.split("");

  return (
    <p className="text-lg sm:text-xl md:text-2xl text-neutral-900 dark:text-neutral-50 leading-relaxed whitespace-pre-wrap">
      {characters.map((char, idx) => {
        // Highlight new characters that just arrived
        const isHighlighted = isStreaming && highlightedIndex !== null && idx >= highlightedIndex;
        return (
          <span
            key={idx}
            style={{
              color: isHighlighted ? highlightColor : undefined,
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

