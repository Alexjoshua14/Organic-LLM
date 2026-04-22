"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/third-party/ui/button";

export type UseSimulatedStreamOptions = {
  /** Milliseconds between chunk steps */
  tickMs?: number;
  /** Characters appended per tick */
  chunkChars?: number;
};

/**
 * Character/chunk timer for the frozen assistant reply — scroll-independent (per showcase spec).
 */
export function useSimulatedStream(fullText: string, options?: UseSimulatedStreamOptions) {
  const tickMs = options?.tickMs ?? 22;
  const chunkChars = options?.chunkChars ?? 4;
  const [displayedText, setDisplayedText] = useState("");
  const [complete, setComplete] = useState(false);
  const generationRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const run = useCallback(() => {
    clear();
    const gen = ++generationRef.current;

    setDisplayedText("");
    setComplete(false);
    if (!fullText.length) {
      setComplete(true);

      return;
    }
    let i = 0;

    intervalRef.current = setInterval(() => {
      if (gen !== generationRef.current) return;
      i += chunkChars;
      const next = fullText.slice(0, Math.min(i, fullText.length));

      setDisplayedText(next);
      if (next.length >= fullText.length) {
        clear();
        setComplete(true);
      }
    }, tickMs);
  }, [chunkChars, clear, fullText, tickMs]);

  useEffect(() => {
    run();

    return () => {
      generationRef.current += 1;
      clear();
    };
  }, [clear, run]);

  const replay = useCallback(() => {
    run();
  }, [run]);

  return { displayedText, complete, replay };
}

export function SimulatedStreamReplayButton({
  onReplay,
  className,
}: {
  onReplay: () => void;
  className?: string;
}) {
  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={onReplay}>
      Replay stream
    </Button>
  );
}
