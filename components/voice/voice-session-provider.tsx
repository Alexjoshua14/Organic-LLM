"use client";

import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";
import type { SpeakToolClientEffect } from "@/lib/speak/types";
import type { VoiceVisualState } from "@/lib/speak/voice-visual-state";
import type { LiveVoicePhase, RealtimeTranscriptEntry } from "@/hooks/use-realtime-voice";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { VoiceLiveBarHost } from "./voice-live-bar-host";

import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { DEFAULT_COMPOSER_MEMORIES } from "@/lib/chat/composer-tool-defaults";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import { applyVoiceEffects, EMPTY_VOICE_VISUAL_STATE } from "@/lib/speak/voice-visual-state";

export type VoiceCaption = {
  role: "user" | "assistant" | "system";
  text: string;
  interim?: boolean;
};

export type VoiceSessionValue = {
  phase: LiveVoicePhase;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  sessionId: string | null;
  threadId: string | null;
  resumedThread: { threadId: string; title: string | null } | null;
  budget: ReturnType<typeof useRealtimeVoice>["budget"];
  transcript: RealtimeTranscriptEntry[];
  caption: VoiceCaption;
  /** Epoch ms the conversation began, across reloads. `null` when idle. */
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  visual: VoiceVisualState;

  modalities: SpeakModalities;
  setModalities: (next: SpeakModalities) => void;
  memoryEnabled: boolean;
  setMemoryEnabled: (next: boolean) => void;

  connect: () => void;
  startNew: () => void;
  disconnect: () => void;
  resetSession: () => void;

  /**
   * Declare what the user is looking at. `null` clears it. Called by `useVoiceScreenContext`,
   * not directly.
   */
  setScreenSurface: (surface: SpeakScreenSurface | null) => void;
  /** Where the live bar renders. CoreInput claims this so the bar reads as its drawer. */
  setBarContainer: (el: HTMLElement | null) => void;
};

const VoiceSessionContext = createContext<VoiceSessionValue | null>(null);

/**
 * Owns the Realtime session for the entire app.
 *
 * ## Why this is mounted in the root layout
 *
 * The peer connection, the mic `MediaStream`, and the `<audio>` sink are all tied to the React
 * tree that created them. Held in a page, they die on every route change. Held here, they
 * survive every client-side navigation in Organic LLM, because the App Router preserves the root
 * layout across them. That is the whole mechanism — no relay, no worker, no polling.
 *
 * A hard reload is the one thing it cannot survive; `resumeIfActive` covers that case by
 * rejoining the server-side session record.
 */
export function VoiceSessionProvider({ children }: { children: ReactNode }) {
  const [modalities, setModalities] = useState<SpeakModalities>(DEFAULT_SPEAK_MODALITIES);
  const [memoryEnabled, setMemoryEnabled] = useState(DEFAULT_COMPOSER_MEMORIES);
  const [caption, setCaption] = useState<VoiceCaption>({ role: "system", text: "" });
  const [visual, setVisual] = useState<VoiceVisualState>(EMPTY_VOICE_VISUAL_STATE);
  const [barContainer, setBarContainer] = useState<HTMLElement | null>(null);
  const [surface, setSurfaceState] = useState<SpeakScreenSurface | null>(null);

  const handleEffects = useCallback((effects: SpeakToolClientEffect[]) => {
    setVisual((prev) => applyVoiceEffects(prev, effects));
  }, []);

  const voice = useRealtimeVoice({
    modalities,
    memoryEnabled,
    onCaptionChange: setCaption,
    onClientEffects: handleEffects,
  });

  const { connected, resumeIfActive, sendScreenContext } = voice;

  // A call that outlived its page. Guarded by a ref because StrictMode mounts effects twice in
  // development and a double resume would mint two calls against one session slot.
  const resumeAttemptedRef = useRef(false);

  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;

    void resumeIfActive();
  }, [resumeIfActive]);

  // Push ambient context whenever the surface or the connection changes. Connecting mid-read
  // matters as much as navigating mid-call: both should leave the model knowing what is open.
  const surfaceKey = surface ? screenSurfaceKey(surface) : null;

  useEffect(() => {
    if (!connected) return;

    void sendScreenContext(surface ?? { kind: "none" });
    // `surfaceKey` is the stable identity; `surface` itself is a fresh object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, surfaceKey, sendScreenContext]);

  const setScreenSurface = useCallback((next: SpeakScreenSurface | null) => {
    setSurfaceState((prev) => {
      const prevKey = prev ? screenSurfaceKey(prev) : null;
      const nextKey = next ? screenSurfaceKey(next) : null;

      return prevKey === nextKey ? prev : next;
    });
  }, []);

  const connect = useCallback(() => void voice.connect(), [voice]);
  const startNew = useCallback(() => void voice.startNew(), [voice]);
  const disconnect = useCallback(() => void voice.disconnect(), [voice]);

  const resetSession = useCallback(() => {
    void voice.resetSession();
    setVisual(EMPTY_VOICE_VISUAL_STATE);
  }, [voice]);

  const value = useMemo<VoiceSessionValue>(
    () => ({
      phase: voice.phase,
      connected: voice.connected,
      connecting: voice.connecting,
      error: voice.error,
      sessionId: voice.sessionId,
      threadId: voice.threadId,
      resumedThread: voice.resumedThread,
      budget: voice.budget,
      transcript: voice.transcript,
      caption,
      startedAt: voice.startedAt,
      localStream: voice.localStream,
      remoteStream: voice.remoteStream,
      visual,
      modalities,
      setModalities,
      memoryEnabled,
      setMemoryEnabled,
      connect,
      startNew,
      disconnect,
      resetSession,
      setScreenSurface,
      setBarContainer,
    }),
    [
      voice.phase,
      voice.connected,
      voice.connecting,
      voice.error,
      voice.sessionId,
      voice.threadId,
      voice.resumedThread,
      voice.budget,
      voice.transcript,
      voice.startedAt,
      voice.localStream,
      voice.remoteStream,
      caption,
      visual,
      modalities,
      memoryEnabled,
      connect,
      startNew,
      disconnect,
      resetSession,
      setScreenSurface,
    ]
  );

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
      {/*
        The single audio sink for the whole app. It must be rendered here and never inside a
        page: re-parenting a playing `<audio>` element restarts it, and unmounting it silences
        a live call.
      */}
      <audio ref={voice.setAudioElement} autoPlay className="hidden">
        <track kind="captions" />
      </audio>
      <VoiceLiveBarHost container={barContainer} />
    </VoiceSessionContext.Provider>
  );
}

export function useVoiceSession(): VoiceSessionValue {
  const context = useContext(VoiceSessionContext);

  if (!context) {
    throw new Error("useVoiceSession must be used within a VoiceSessionProvider");
  }

  return context;
}

/** Non-throwing variant for components that render both inside and outside the provider. */
export function useVoiceSessionOptional(): VoiceSessionValue | null {
  return useContext(VoiceSessionContext);
}
