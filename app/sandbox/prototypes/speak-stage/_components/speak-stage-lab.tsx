"use client";

import type { RealtimeTranscriptEntry } from "@/hooks/use-realtime-voice";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";
import type { SpeakModalities } from "@/lib/schemas/speak-modalities";

import { useEffect, useState } from "react";

import { SpeakSettingsMenu } from "@/app/speak/_components/SpeakSettingsMenu";
import { SpeakStage, type SpeakStageCaption } from "@/app/speak/_components/SpeakStage";
import { SpeakVisualPanel } from "@/app/speak/_components/SpeakVisualPanel";
import { glass } from "@/components/design-system/primitives";
import {
  deriveSpeakStageStatus,
  speakPrimaryAction,
  type SpeakStageConnection,
} from "@/lib/speak/speak-stage-view";
import { cn } from "@/lib/utils";

type LabState =
  | "ready"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "paused"
  | "error"
  | "low-budget"
  | "visuals";

const STATES: Array<{ id: LabState; label: string }> = [
  { id: "ready", label: "Ready" },
  { id: "connecting", label: "Connecting" },
  { id: "listening", label: "Listening" },
  { id: "thinking", label: "Thinking" },
  { id: "speaking", label: "Speaking" },
  { id: "muted", label: "Muted" },
  { id: "paused", label: "Paused" },
  { id: "error", label: "Error" },
  { id: "low-budget", label: "Low allowance" },
  { id: "visuals", label: "With visuals" },
];

const BUDGET: SpeakBudgetSnapshot = {
  monthlyCostCapUsd: 20,
  monthlyCostUsedUsd: 3.42,
  monthlyCostRemainingUsd: 16.58,
  dailyMinutesCap: 30,
  dailyMinutesRemaining: 22,
  sessionMaxMinutes: 8,
  concurrentSessions: 1,
  activeSessions: 0,
};

const LOW_BUDGET: SpeakBudgetSnapshot = {
  ...BUDGET,
  dailyMinutesRemaining: 3,
};

const TRANSCRIPT: RealtimeTranscriptEntry[] = [
  { id: "t1", role: "user", text: "Okay, I want to think through the onboarding flow again." },
  {
    id: "t2",
    role: "assistant",
    text: "Sure. Last time you were stuck on whether the first screen should ask for anything at all. Where are you leaning now?",
  },
  {
    id: "t3",
    role: "user",
    text: "Honestly I think it shouldn't. Let people talk first and ask for details later.",
  },
  {
    id: "t4",
    role: "assistant",
    text: "That fits what you said about friction. The risk is that the first answer is generic because it knows nothing about them.",
  },
];

const SPEAKING_CAPTION: SpeakStageCaption = {
  role: "assistant",
  text: "That fits what you said about friction. The risk is the first answer is generic.",
};

const LISTENING_CAPTION: SpeakStageCaption = {
  role: "user",
  text: "Honestly I think it shouldn't. Let people talk first and",
  interim: true,
};

function connectionFor(state: LabState): SpeakStageConnection {
  const base: SpeakStageConnection = {
    connected: false,
    connecting: false,
    paused: false,
    error: null,
    phase: "idle",
    muted: false,
  };

  switch (state) {
    case "connecting":
      return { ...base, connecting: true };
    case "listening":
    case "visuals":
      return { ...base, connected: true, phase: "listening" };
    case "thinking":
      return { ...base, connected: true, phase: "thinking" };
    case "speaking":
      return { ...base, connected: true, phase: "speaking" };
    case "muted":
      return { ...base, connected: true, phase: "listening", muted: true };
    case "paused":
      return { ...base, paused: true };
    case "error":
      return {
        ...base,
        error: "Microphone access was blocked. Allow it in your browser's site settings.",
      };
    case "low-budget":
      return { ...base, connected: true, phase: "listening" };
    default:
      return base;
  }
}

/**
 * An inaudible generated "voice": an oscillator whose loudness follows a syllable-like envelope,
 * routed only to a MediaStream (never to the speakers). Lets the orb react without a mic.
 */
function useSyntheticVoice(enabled: boolean): MediaStream | null {
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!Ctor) return;

    const context = new Ctor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();

    oscillator.type = "sawtooth";
    oscillator.frequency.value = 180;
    gain.gain.value = 0;
    oscillator.connect(gain).connect(destination);
    oscillator.start();

    const interval = window.setInterval(() => {
      const now = context.currentTime;
      const level = Math.random() < 0.2 ? 0.02 : 0.15 + Math.random() * 0.35;

      gain.gain.setTargetAtTime(level, now, 0.05);
      oscillator.frequency.setTargetAtTime(140 + Math.random() * 120, now, 0.08);
    }, 140);

    void context.resume().catch(() => undefined);
    setStream(destination.stream);

    return () => {
      window.clearInterval(interval);
      oscillator.stop();
      void context.close().catch(() => undefined);
      setStream(null);
    };
  }, [enabled]);

  return stream;
}

export function SpeakStageLab() {
  const [state, setState] = useState<LabState>("speaking");
  const [synthetic, setSynthetic] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [modalities, setModalities] = useState<SpeakModalities>({
    text: true,
    genUi: false,
    web: false,
  });
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [startedAt] = useState(() => Date.now() - 3 * 60_000 - 12_000);

  const connection = connectionFor(state);
  const status = deriveSpeakStageStatus(connection);
  const live = connection.connected;
  const syntheticStream = useSyntheticVoice(synthetic && live);
  const showVisuals = state === "visuals" || modalities.genUi || modalities.web;

  const caption =
    state === "speaking" ? SPEAKING_CAPTION : state === "listening" ? LISTENING_CAPTION : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        aria-label="Stage state"
        className={cn(
          glass({ border: "none" }),
          "flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/50 px-inset-lg py-2"
        )}
        role="toolbar"
      >
        {STATES.map((s) => (
          <button
            key={s.id}
            aria-pressed={state === s.id}
            className={cn(
              "h-8 shrink-0 rounded-full px-inset-md text-xs transition-colors",
              state === s.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"
            )}
            type="button"
            onClick={() => setState(s.id)}
          >
            {s.label}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border/60" />
        <label className="flex h-8 shrink-0 items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <input
            checked={synthetic}
            className="accent-current"
            type="checkbox"
            onChange={(event) => setSynthetic(event.target.checked)}
          />
          Synthetic voice
        </label>
      </div>

      <div className="min-h-0 flex-1">
        <SpeakStage
          budget={state === "low-budget" ? LOW_BUDGET : BUDGET}
          canStartNew={!live && !connection.connecting}
          caption={caption}
          contextLine={live ? "Continuing “Onboarding flow”" : null}
          localStream={state === "listening" ? syntheticStream : null}
          memoryEnabled={memoryEnabled}
          muted={connection.muted}
          panelOpen={panelOpen}
          primaryAction={speakPrimaryAction(connection)}
          remoteStream={state === "listening" ? null : syntheticStream}
          settings={
            <SpeakSettingsMenu
              locked={live || connection.connecting}
              memoryEnabled={memoryEnabled}
              modalities={modalities}
              onMemoryEnabledChange={setMemoryEnabled}
              onModalitiesChange={setModalities}
              onReset={() => setState("ready")}
            />
          }
          startedAt={live ? startedAt : null}
          status={status}
          transcript={state === "ready" || state === "connecting" ? [] : TRANSCRIPT}
          transcriptAvailable={modalities.text}
          visuals={
            showVisuals ? (
              <SpeakVisualPanel
                genUiBlocks={[]}
                showGenUi
                showWeb={false}
                uiStateBySurface={
                  state === "visuals"
                    ? {
                        onboarding: [
                          { id: "step-1", data: { title: "Talk first", asks: 0 } },
                          { id: "step-2", data: { title: "Ask for a name", asks: 1 } },
                        ],
                      }
                    : {}
                }
                webPreview={null}
              />
            ) : undefined
          }
          onPanelOpenChange={setPanelOpen}
          onPrimary={() =>
            setState((current) => {
              const action = speakPrimaryAction(connectionFor(current));

              return action === "end" ? "ready" : action === "connecting" ? current : "listening";
            })
          }
          onStartNew={() => setState("ready")}
          onSwitchToReadAloud={() => undefined}
          onToggleMute={() => setState((s) => (s === "muted" ? "listening" : "muted"))}
        />
      </div>
    </div>
  );
}
