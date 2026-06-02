/**
 * TypewriterPrototype - Display-only component for streaming text animation
 * 
 * Accepts raw text directly (like from AI SDK). Handles cursor blink internally.
 * 
 * Example usage:
 * ```tsx
 * // Direct usage (no buffer)
 * <TypewriterPrototype text={aiStreamText} isStreaming={isStreaming} showCursor={true} />
 * ```
 */

import { useEffect, useState } from "react";

interface TypewriterPrototypeProps {
  text: string;
  isStreaming: boolean;
  showCursor?: boolean;
}

export function TypewriterPrototype({
  text,
  isStreaming,
  showCursor = true,
}: TypewriterPrototypeProps) {
  const [shouldBlink, setShouldBlink] = useState(false);

  // Cursor blink effect - start blinking after 250ms of inactivity
  useEffect(() => {
    if (!isStreaming) {
      setShouldBlink(true);
      return;
    }

    setShouldBlink(false);
    const blinkTimer = setTimeout(() => {
      setShouldBlink(true);
    }, 250);

    return () => clearTimeout(blinkTimer);
  }, [text, isStreaming]);

  return (
    <p className="text-lg sm:text-xl md:text-2xl text-neutral-900 dark:text-neutral-50 leading-relaxed whitespace-pre-wrap">
      {text}
      {isStreaming && showCursor && (
        <span
          className={`inline-block w-0.5 h-5 sm:h-6 md:h-7 bg-neutral-900 dark:bg-neutral-50 ml-1 ${shouldBlink ? "animate-pulse" : ""
            }`}
        />
      )}
    </p>
  );
}

