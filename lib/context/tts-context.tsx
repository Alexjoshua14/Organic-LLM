"use client";

import { Button } from "@heroui/button";
import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { TTSDockLayout, ttsDockAudioSurfaceClass } from "@/components/tts/tts-dock-layout";
import { useTTS, type TTSStatus } from "@/hooks/use-tts";
import { shouldDeferAudioAutoplayToUserGesture } from "@/lib/tts/defer-audio-autoplay";

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
  /**
   * True on iOS WebKit (and iPad-as-Mac): async TTS must not call `play()`; user uses native controls or a second tap.
   */
  deferPlaybackToUserGesture: boolean;
};

const TTSContext = createContext<TTSContextValue | null>(null);

export function TTSProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speakGenerationRef = useRef(0);
  const [currentText, setCurrentText] = useState<string | null>(null);
  /** iOS WebKit: avoid autoplay after async TTS work — user taps native play (gesture). */
  const [deferPlaybackToUserGesture] = useState(() => shouldDeferAudioAutoplayToUserGesture());

  const { prime, streamAudio, status, play, pause, close } = useTTS({
    audioRef,
    autoplay: !deferPlaybackToUserGesture,
    showNativeControls: true,
  });

  const speak = useCallback(
    (text: string) => {
      setCurrentText(text);
      const gen = ++speakGenerationRef.current;

      const audio = audioRef.current;

      if (audio) {
        audio.pause(); // stop whatever's playing — synchronous, fine
        prime(); // bless the element while still in gesture stack
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
    () => ({
      speak,
      stop,
      play,
      pause,
      status,
      currentText,
      audioRef,
      deferPlaybackToUserGesture,
    }),
    [speak, stop, play, pause, status, currentText, audioRef, deferPlaybackToUserGesture]
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
    <TTSDockLayout
      show={showDockedPlayer}
      variant="pageBottom"
      audio={
        <>
          {/* nomute: Chromium; Safari may still show mute — best-effort per spec */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- TTS playback sink only; no captions stream */}
          <audio
            ref={audioRef}
            controls
            controlsList="nomute"
            preload="none"
            className={ttsDockAudioSurfaceClass(showDockedPlayer)}
            aria-hidden={!showDockedPlayer}
          />
        </>
      }
      trailing={
        <Button isIconOnly size="sm" variant="ghost" aria-label="Stop playback" onPress={stop}>
          <X className="h-4 w-4 shrink-0" />
        </Button>
      }
    />
  );
}

export function useTTSContext(): TTSContextValue {
  const ctx = useContext(TTSContext);

  if (!ctx) {
    throw new Error("useTTSContext must be used within TTSProvider");
  }

  return ctx;
}

export function useTTSOptional(): TTSContextValue | null {
  return useContext(TTSContext);
}
