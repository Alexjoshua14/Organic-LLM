"use client";

import type { ReactNode } from "react";
import type { VoiceSessionValue } from "@/components/voice/voice-session-provider";
import type { LabVoiceBarMode } from "../_lib/lab-state";

import { useMemo, useState } from "react";

import { VoiceLiveBarHost } from "@/components/voice/voice-live-bar-host";
import { VoiceSessionContext } from "@/components/voice/voice-session-provider";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { EMPTY_VOICE_VISUAL_STATE } from "@/lib/speak/voice-visual-state";

const noop = () => {};

/**
 * The data the real live bar reads for each lab state. Typed as `VoiceSessionValue`, so a field
 * added to the real session fails to compile here instead of silently going missing in the lab.
 * Nothing opens a mic or a connection; only the values the bar displays are faked.
 */
function createLabVoiceSession(
  mode: LabVoiceBarMode,
  setBarContainer: (el: HTMLElement | null) => void,
  onModeChange: (next: LabVoiceBarMode) => void
): VoiceSessionValue {
  const connected = mode === "live";

  return {
    stage: false,
    phase: connected ? "listening" : "idle",
    connected,
    connecting: mode === "connecting",
    paused: mode === "paused",
    error: null,
    sessionId: null,
    threadId: null,
    resumedThread: null,
    budget: null,
    transcript: [],
    caption: { role: "system", text: "" },
    personaTurn: null,
    startedAt: connected ? Date.now() : null,
    localStream: null,
    remoteStream: null,
    visual: EMPTY_VOICE_VISUAL_STATE,
    screenContext: null,
    modalities: DEFAULT_SPEAK_MODALITIES,
    setModalities: noop,
    memoryEnabled: true,
    setMemoryEnabled: noop,
    connect: () => onModeChange("live"),
    startNew: () => onModeChange("live"),
    resume: () => onModeChange("live"),
    speakToSubagent: async () => onModeChange("live"),
    // The bar's end button: ends the call the way the real one does.
    disconnect: () => onModeChange("off"),
    resetSession: noop,
    sendSubagentProgress: async () => false,
    sendSubagentMilestone: async () => false,
    sendTextEvent: () => false,
    setScreenSurface: noop,
    setBarContainer,
    setBarPageAnchor: noop,
    suppressHostBar: false,
    setSuppressHostBar: noop,
  };
}

/**
 * Lets the lab show CoreInput with the live voice bar on, off, connecting or paused.
 *
 * It renders the real `VoiceLiveBarHost`, which renders the real `VoiceLiveBar`, into the real
 * `CoreInputVoiceDrawerSlot` that CoreInput mounts. This wrapper only replaces the session those
 * read, so the bar and its drawer behavior cannot drift from what ships.
 */
export function LabVoiceBar({
  mode,
  onModeChange,
  children,
}: {
  mode: LabVoiceBarMode;
  onModeChange: (next: LabVoiceBarMode) => void;
  children: ReactNode;
}) {
  const [barContainer, setBarContainer] = useState<HTMLElement | null>(null);
  const value = useMemo(
    () => createLabVoiceSession(mode, setBarContainer, onModeChange),
    [mode, onModeChange]
  );

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
      {/* Without the slot's claim the host would fall back to a viewport-fixed anchor. */}
      {barContainer ? <VoiceLiveBarHost container={barContainer} pageAnchor={null} /> : null}
    </VoiceSessionContext.Provider>
  );
}
