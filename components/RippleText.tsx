/**
 * RippleText - Streaming text with color wave effect
 * Characters transition from highlight color to base color as they appear
 * 
 * Uses CSS animations for GPU-accelerated performance. Characters are revealed
 * with staggered delays, and new characters are highlighted as they appear.
 * 
 * Example usage:
 * ```tsx
 * <RippleText text={aiStreamText} latestMessage={true} />
 * ```
 */

import { useRef, useEffect, useMemo, useState } from "react";
import "@/styles/RippleText.css";

interface RippleTextProps {
  latestMessage: boolean;
  text: string;
  isStreaming?: boolean;
  highlightColor?: string;
  transitionDuration?: number; // Duration in milliseconds
  speed?: number; // Milliseconds per character reveal
}

export function RippleText({
  text,
  highlightColor = "var(--destructive)",
  latestMessage,
  transitionDuration = 150,
  speed = 5,
}: RippleTextProps) {
  const prevTextLengthRef = useRef(0);
  const [revealedLength, setRevealedLength] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Reset and start animation when latestMessage becomes true
  useEffect(() => {
    if (latestMessage) {
      setRevealedLength(text.length);
      setAnimationKey(prev => prev + 1); // Force re-animation
      prevTextLengthRef.current = text.length;
    } else {
      setRevealedLength(0);
      prevTextLengthRef.current = 0;
    }
  }, [latestMessage, text.length]);

  // Track new content for highlighting
  const highlightStart = useMemo(() => {
    if (latestMessage && text.length > prevTextLengthRef.current) {
      const start = prevTextLengthRef.current;
      prevTextLengthRef.current = text.length;
      return start;
    }
    return null;
  }, [text.length, latestMessage]);

  // Split text into characters once
  const characters = useMemo(() => text.split(""), [text]);

  return (
    <p
      key={animationKey}
      style={{
        // CSS custom properties for animation control
        ['--ripple-speed' as string]: `${speed}ms`,
        ['--ripple-transition-duration' as string]: `${transitionDuration}ms`,
        ['--ripple-highlight-color' as string]: highlightColor,
      }}
    >
      {characters.map((char, idx) => {
        const isRevealed = latestMessage && idx < revealedLength;
        const isHighlighted = latestMessage &&
          highlightStart !== null &&
          idx >= highlightStart &&
          idx < text.length;

        // Calculate delay for highlight transition (starts after character is revealed)
        const revealDelay = idx * speed;
        const highlightTransitionDelay = isHighlighted
          ? `${revealDelay + 50}ms` // Start highlight transition slightly after reveal
          : '0ms';

        return (
          <span
            key={`${animationKey}-${idx}`}
            className={`ripple-character ${isRevealed ? 'revealed' : ''} ${isHighlighted ? 'highlighted' : ''}`}
            style={{
              ['--ripple-char-index' as string]: idx,
              ['--ripple-transition-delay' as string]: highlightTransitionDelay,
            }}
          >
            {char}
          </span>
        );
      })}
    </p>
  );
}

