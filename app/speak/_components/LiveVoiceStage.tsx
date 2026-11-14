"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SpeakSettingsMenu } from "./SpeakSettingsMenu";
import { SpeakStage, type SpeakStageCaption } from "./SpeakStage";
import { SpeakVisualPanel } from "./SpeakVisualPanel";

import { SpeakPersonaChip } from "@/components/personas/persona-chip";
import { PersonaSpark, type PersonaSparkState } from "@/components/personas/persona-spark";
import { PersonaStarters } from "@/components/personas/persona-starters";
import {
  usePersonaScope,
  usePersonaSessionOptional,
} from "@/components/personas/persona-session-provider";
import { useVoiceSession } from "@/components/voice/voice-session-provider";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { SPEAK_PERSONA_SCOPE } from "@/lib/personas/unified/session";
import {
  deriveSpeakStageStatus,
  speakPrimaryAction,
  speakShortcutFor,
} from "@/lib/speak/speak-stage-view";

/** Matches Tailwind's `lg`, where the panel becomes a column instead of a sheet. */
const WIDE_PANEL_QUERY = "(min-width: 1024px)";

/** Whether focus is on something that owns Space/Enter itself. */
function isInteractiveTarget(el: Element | null): boolean {
  if (!el || el === document.body) return false;
  // The End button lets Space through so it mutes instead of hanging up.
  if (el.closest("[data-speak-space-passthrough]")) return false;

  return Boolean(el.closest("button, a[href], [role='button'], [role='switch'], [role='tab']"));
}

/**
 * Container for the Speak stage. Reads the app-wide voice session and the persona session,
 * owns the page-local UI state (mute, panel), and hands {@link SpeakStage} a view model.
 *
 * The session lives in `VoiceSessionProvider` at the root layout so it survives navigation.
 * This page owns none of the connection.
 */
export function LiveVoiceStage({ onExit }: { onExit?: () => void }) {
  const { refreshSidebarChats } = useSharedChatContext();
  const voice = useVoiceSession();
  const persona = usePersonaSessionOptional();

  // Speak is its own scope — enabling here must not force-enable unrelated chats.
  usePersonaScope(SPEAK_PERSONA_SCOPE);
  const personaActive = Boolean(persona?.session);
  const { caption, modalities, setModalities, memoryEnabled, setMemoryEnabled, visual } = voice;
  const { displayText, genUiBlocks, webPreview, uiStateBySurface } = visual;
  const { setSuppressHostBar, localStream, connected } = voice;

  const [muted, setMuted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const sessionLocked = voice.connected || voice.connecting;

  // This page is the call's full surface; the global live bar would be a second, smaller copy
  // of the same controls (and a second End button). Hand it back on the way out.
  useEffect(() => {
    setSuppressHostBar(true);

    return () => setSuppressHostBar(false);
  }, [setSuppressHostBar]);

  // Speak threads carry `feature: "speak"`, so they only list under coalescence mode, but the
  // sidebar should still learn about a new thread the moment a session creates one.
  useEffect(() => {
    if (voice.threadId) refreshSidebarChats();
  }, [refreshSidebarChats, voice.threadId]);

  // Mute is a local track switch: the peer connection stays up and the model hears silence.
  // It never outlives this page, because no other surface shows that the mic is off.
  useEffect(() => {
    if (!localStream) return;

    for (const track of localStream.getAudioTracks()) track.enabled = !muted;

    return () => {
      for (const track of localStream.getAudioTracks()) track.enabled = true;
    };
  }, [localStream, muted]);

  useEffect(() => {
    if (!connected) setMuted(false);
  }, [connected]);

  const status = useMemo(
    () =>
      deriveSpeakStageStatus({
        connected: voice.connected,
        connecting: voice.connecting,
        paused: voice.paused,
        error: voice.error,
        phase: voice.phase,
        muted,
      }),
    [muted, voice.connected, voice.connecting, voice.error, voice.paused, voice.phase]
  );
  const primaryAction = speakPrimaryAction(voice);

  const { connect, disconnect, resume } = voice;
  const onPrimary = useCallback(() => {
    if (primaryAction === "end") disconnect();
    else if (primaryAction === "resume") resume();
    else if (primaryAction === "start") connect();
  }, [connect, disconnect, primaryAction, resume]);

  const showVisuals =
    modalities.genUi || modalities.web || Object.keys(uiStateBySurface).length > 0;

  // Wide screens have room for the transcript beside the call, so it starts open there.
  useEffect(() => {
    if (window.matchMedia?.(WIDE_PANEL_QUERY).matches) setPanelOpen(true);
  }, []);

  // A card or page is evidence for what is being said: surface it as it arrives.
  const latestVisualKey = `${genUiBlocks.length}:${webPreview?.url ?? ""}`;

  useEffect(() => {
    if (latestVisualKey !== "0:") setPanelOpen(true);
  }, [latestVisualKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const shortcut = speakShortcutFor(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          repeat: event.repeat,
          targetTag: target?.tagName ?? null,
          targetEditable: target instanceof HTMLElement && target.isContentEditable,
          targetInteractive: isInteractiveTarget(target),
        },
        { connected: voice.connected, connecting: voice.connecting }
      );

      if (!shortcut) return;
      if (shortcut === "toggle-transcript" && !modalities.text && !showVisuals) return;

      event.preventDefault();
      if (shortcut === "primary") onPrimary();
      else if (shortcut === "toggle-mute") setMuted((m) => !m);
      else setPanelOpen((open) => !open);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalities.text, onPrimary, showVisuals, voice.connected, voice.connecting]);

  const turn = voice.personaTurn;
  // The assistant's visual follows the call: listening, deciding, speaking, else at rest.
  const sparkState: PersonaSparkState = !voice.connected
    ? "idle"
    : voice.phase === "speaking"
      ? "speaking"
      : voice.phase === "listening"
        ? "listening"
        : turn?.state === "deciding"
          ? "deciding"
          : "idle";

  const stageCaption: SpeakStageCaption | null = !modalities.text
    ? null
    : displayText
      ? { role: "assistant", text: displayText }
      : voice.connected && caption.text
        ? caption
        : null;

  const contextLine =
    voice.connected && voice.resumedThread
      ? voice.resumedThread.title
        ? `Continuing “${voice.resumedThread.title}”`
        : "Continuing your last conversation"
      : personaActive && !voice.connected
        ? "Artist assistant — asides are heard, not answered"
        : null;

  return (
    <SpeakStage
      budget={voice.budget}
      canStartNew={!sessionLocked}
      caption={stageCaption}
      contextLine={contextLine}
      localStream={voice.localStream}
      memoryEnabled={memoryEnabled}
      muted={muted}
      panelOpen={panelOpen}
      personaChip={<SpeakPersonaChip locked={sessionLocked} />}
      presence={
        personaActive ? (
          <PersonaSpark
            pulseKey={turn && (turn.state === "heard" || turn.state === "held") ? turn.at : null}
            size={200}
            state={sparkState}
          />
        ) : undefined
      }
      primaryAction={primaryAction}
      remoteStream={voice.remoteStream}
      settings={
        <SpeakSettingsMenu
          locked={sessionLocked}
          memoryEnabled={memoryEnabled}
          modalities={modalities}
          onMemoryEnabledChange={setMemoryEnabled}
          onModalitiesChange={setModalities}
          onReset={voice.resetSession}
        />
      }
      startedAt={voice.startedAt}
      status={status}
      statusExtra={
        personaActive ? (
          voice.connected ? (
            <p aria-live="polite" className="min-h-4 text-2xs text-muted-foreground" role="status">
              {turn && turn.state !== "listening" ? turn.label : ""}
            </p>
          ) : (
            <div className="mt-stack-md w-full max-w-lg">
              <PersonaStarters compact />
            </div>
          )
        ) : null
      }
      transcript={voice.transcript}
      transcriptAvailable={modalities.text}
      visuals={
        showVisuals ? (
          <SpeakVisualPanel
            genUiBlocks={genUiBlocks}
            showGenUi={modalities.genUi}
            showWeb={modalities.web}
            uiStateBySurface={uiStateBySurface}
            webPreview={webPreview}
          />
        ) : undefined
      }
      onPanelOpenChange={setPanelOpen}
      onPrimary={onPrimary}
      onStartNew={() => voice.startNew()}
      onSwitchToReadAloud={onExit}
      onToggleMute={() => setMuted((m) => !m)}
    />
  );
}
