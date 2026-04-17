"use client";

import { Button } from "@heroui/button";
import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { glass } from "@/components/design-system/primitives";
import { useTTS, type TTSStatus } from "@/hooks/use-tts";
import { shouldDeferAudioAutoplayToUserGesture } from "@/lib/tts/defer-audio-autoplay";
import { cn } from "@/lib/utils";

export type { TTSStatus };

export type TTSContextValue = {
  speak: (text: string) => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  status: TTSStatus;
  currentText: string | null;
  /** Mount `TTSDockBar` in `Page` so this ref attaches to `<audio>` inside the page column. */
  audioRef: RefObject<HTMLAudioElement | null>;
};

const TTSContext = createContext<TTSContextValue | null>(null);

export function TTSProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speakGenerationRef = useRef(0);
  const [currentText, setCurrentText] = useState<string | null>(null);
  /** iOS WebKit: avoid autoplay after async TTS work — user taps native play (gesture). */
  // const [deferAutoplay] = useState(() => shouldDeferAudioAutoplayToUserGesture());

  const { prime, streamAudio, status, play, pause, close } = useTTS({
    audioRef,
    autoplay: true,
    showNativeControls: true,
  });

  const speak = useCallback(
    (text: string) => {
      setCurrentText(text);
      const gen = ++speakGenerationRef.current;

      const audio = audioRef.current;
      if (audio) {
        audio.pause();      // stop whatever's playing — synchronous, fine
        prime();            // bless the element while still in gesture stack
      }

      void (async () => {
        // Don't call close() here — it does audio.src = ""; audio.load()
        // which is redundant (streamAudio sets its own src) and risks
        // interfering with the prime on some WebKit builds.
        if (gen !== speakGenerationRef.current) return;
        await streamAudio({ text });
      })();
    },
    [streamAudio, prime, audioRef]
  );

  const stop = useCallback(() => {
    speakGenerationRef.current += 1;
    setCurrentText(null);
    void close();
  }, [close]);

  const value = useMemo(
    () => ({ speak, stop, play, pause, status, currentText, audioRef }),
    [speak, stop, play, pause, status, currentText, audioRef]
  );

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}

/**
 * Renders the docked `<audio controls>` + stop control inside a `relative` page shell (e.g. [`Page`](components/layout/page.tsx)).
 * Mount once at the end of that shell so positioning is relative to the page column, not the viewport.
 */
export function TTSDockBar() {
  const { audioRef, stop, status, currentText } = useTTSContext();
  const showDockedPlayer = currentText !== null || status !== "ready";

  return (
    <div
      className={cn(
        !showDockedPlayer
          ? "sr-only"
          : "absolute inset-x-0 bottom-0 z-200 flex justify-center px-2 pt-0.5 pb-[max(0.125rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          showDockedPlayer
            ? cn(
              glass({ border: "none" }),
              "w-fit max-w-[min(100%,40rem)] rounded-xl border border-white/10 px-2 py-0.5 shadow-md"
            )
            : "contents"
        )}
      >
        {/* nomute: Chromium; Safari may still show mute — best-effort per spec */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- TTS playback sink only; no captions stream */}
        <audio
          ref={audioRef}
          controls
          controlsList="nomute"
          preload="none"
          className={cn(
            "box-border bg-transparent",
            showDockedPlayer
              ? "h-auto min-h-0 w-[min(100vw-4rem,28rem)] max-w-full shrink"
              : "h-px w-px min-h-0"
          )}
          aria-hidden={!showDockedPlayer}
        />
        {showDockedPlayer ? (
          <Button isIconOnly size="sm" variant="ghost" aria-label="Stop playback" onPress={stop}>
            <X className="h-4 w-4 shrink-0" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function useTTSContext(): TTSContextValue {
  const ctx = useContext(TTSContext);

  if (!ctx) {
    throw new Error("useTTSContext must be used within TTSProvider");
  }

  return ctx;
}
