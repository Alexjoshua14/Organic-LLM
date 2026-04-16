"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { useTTS, type TTSStatus } from "@/hooks/use-tts";

export type { TTSStatus };

export type TTSContextValue = {
  speak: (text: string) => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  status: TTSStatus;
  currentText: string | null;
};

const TTSContext = createContext<TTSContextValue | null>(null);

export function TTSProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speakGenerationRef = useRef(0);
  const [currentText, setCurrentText] = useState<string | null>(null);

  const { streamAudio, status, play, pause, close } = useTTS({
    audioRef,
    autoplay: true,
    showNativeControls: true,
  });

  const speak = useCallback(
    (text: string) => {
      setCurrentText(text);
      const gen = ++speakGenerationRef.current;

      void (async () => {
        await close();
        if (gen !== speakGenerationRef.current) {
          return;
        }
        await streamAudio({ text });
      })();
    },
    [streamAudio, close]
  );

  const stop = useCallback(() => {
    speakGenerationRef.current += 1;
    void close();
    setCurrentText(null);
  }, [close]);

  const value = useMemo(
    () => ({ speak, stop, play, pause, status, currentText }),
    [speak, stop, play, pause, status, currentText]
  );

  const showDockedPlayer = currentText !== null || status !== "ready";

  return (
    <TTSContext.Provider value={value}>
      {children}
      {/* Wrapper gives the bar layout + z-index; `z-100` is not a default Tailwind token (was a no-op). */}
      <div
        className={cn(
          showDockedPlayer
            ? "pointer-events-auto fixed inset-x-0 bottom-0 z-[200] flex justify-center border-t border-white/10 bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-6px_24px_rgba(0,0,0,0.35)]"
            : "sr-only"
        )}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- TTS playback sink only; no captions stream */}
        <audio
          ref={audioRef}
          controls
          preload="none"
          className={cn(
            "box-border max-w-2xl bg-transparent",
            showDockedPlayer ? "block h-14 w-96 min-w-[min(100%,18rem)]" : "h-px w-px min-h-0"
          )}
          aria-hidden={!showDockedPlayer}
        />
      </div>
    </TTSContext.Provider>
  );
}

export function useTTSContext(): TTSContextValue {
  const ctx = useContext(TTSContext);

  if (!ctx) {
    throw new Error("useTTSContext must be used within TTSProvider");
  }

  return ctx;
}
