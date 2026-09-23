"use client";

import { useEffect, useMemo } from "react";
import { Loader2, Mic, PhoneOff, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { KaraokeCaption } from "./KaraokeCaption";
import { SpeakBudgetChip } from "./SpeakBudgetChip";
import { SpeakModalityToggles } from "./SpeakModalityToggles";
import { SpeakVisualPanel } from "./SpeakVisualPanel";
import { VoicePresenceOrb } from "./VoicePresenceOrb";

import { glass } from "@/components/design-system/primitives";
import { useVoiceSession } from "@/components/voice/voice-session-provider";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { cn } from "@/lib/utils";

export function LiveVoiceStage({ onExit }: { onExit?: () => void }) {
  const { refreshSidebarChats } = useSharedChatContext();
  /**
   * The session itself lives in `VoiceSessionProvider` at the root layout so it survives
   * navigation. This page is now a view onto it: it renders the stage and owns none of the
   * connection, captions, or tool output.
   */
  const voice = useVoiceSession();
  const { caption, modalities, setModalities, memoryEnabled, setMemoryEnabled, visual } = voice;
  const { displayText, genUiBlocks, webPreview, uiStateBySurface } = visual;

  const sessionLocked = voice.connected || voice.connecting;

  // Speak threads carry `feature: "speak"`, so they only list under coalescence mode, but the
  // sidebar should still learn about a new thread the moment a session creates one.
  useEffect(() => {
    if (voice.threadId) refreshSidebarChats();
  }, [refreshSidebarChats, voice.threadId]);

  const showVisualPanel =
    modalities.genUi || modalities.web || Object.keys(uiStateBySurface).length > 0;

  const statusHint = useMemo(() => {
    if (voice.connecting) return "Connecting…";
    if (voice.connected) {
      switch (voice.phase) {
        case "listening":
          return "Listening — keep talking or pause";
        case "speaking":
          return "Speaking — interrupt anytime";
        default:
          return "Connected — speak naturally";
      }
    }

    if (voice.paused)
      return "Paused after a quiet stretch — tap the mic to pick up where you left off";

    return "Tap the mic to start a Realtime voice session";
  }, [voice.connected, voice.connecting, voice.paused, voice.phase]);

  const resumeHint = voice.resumedThread
    ? voice.resumedThread.title
      ? `Continuing “${voice.resumedThread.title}”`
      : "Continuing your last conversation"
    : null;

  const idleHint = "Realtime voice — picks up your last conversation. Tap + for a fresh one.";
  const captionText =
    displayText && modalities.text
      ? displayText
      : caption.text || (voice.connected ? "" : idleHint);
  const showText = modalities.text;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SpeakModalityToggles
            disabled={sessionLocked}
            value={modalities}
            onChange={setModalities}
          />
          <button
            aria-pressed={memoryEnabled}
            className={cn(
              glass({ border: "all" }),
              "rounded-2xl px-3 py-1.5 text-xs transition-colors",
              memoryEnabled ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              sessionLocked && "opacity-60"
            )}
            disabled={sessionLocked}
            title={
              sessionLocked
                ? "End session to change memory"
                : "Recall what you know about me and save this conversation"
            }
            type="button"
            onClick={() => setMemoryEnabled(!memoryEnabled)}
          >
            Memory {memoryEnabled ? "on" : "off"}
          </button>
        </div>
        <SpeakBudgetChip budget={voice.budget} />
      </div>

      <div
        className={cn("flex min-h-0 flex-1", showVisualPanel ? "flex-col lg:flex-row" : "flex-col")}
      >
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-16">
          {/* The audio sink lives in VoiceSessionProvider — it must not unmount on navigation. */}

          <AnimatePresence mode="wait">
            <motion.div
              key={voice.phase + String(voice.connected)}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8"
              exit={{ opacity: 0.6, scale: 0.98 }}
              initial={{ opacity: 0.7, scale: 0.96 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <VoicePresenceOrb phase={voice.phase} />

              {showText ? (
                <div className="min-h-[5rem] w-full max-w-3xl">
                  <KaraokeCaption
                    interim={caption.interim}
                    role={caption.role}
                    text={captionText}
                  />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <p className="mt-6 text-xs text-muted-foreground">{statusHint}</p>

          {voice.connected && resumeHint ? (
            <p className="mt-1 text-2xs text-muted-foreground/80">{resumeHint}</p>
          ) : null}

          {voice.error ? (
            <p className="mt-2 max-w-md text-center text-xs text-destructive">{voice.error}</p>
          ) : null}

          <div className="mt-10 flex items-center gap-4">
            {!voice.connected ? (
              <button
                aria-label={voice.paused ? "Resume Realtime voice" : "Start Realtime voice"}
                className={cn(
                  glass({ opaque: true, border: "all" }),
                  "flex size-20 items-center justify-center rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg"
                )}
                disabled={voice.connecting}
                type="button"
                onClick={voice.paused ? voice.resume : voice.connect}
              >
                {voice.connecting ? (
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                ) : (
                  <Mic className="size-8 text-foreground" />
                )}
              </button>
            ) : (
              <button
                aria-label="End Realtime session"
                className={cn(
                  glass({ opaque: true, border: "all" }),
                  "flex size-20 items-center justify-center rounded-full border-rose-400/50 bg-rose-500/15 shadow-[0_0_40px_rgba(244,63,94,0.2)]"
                )}
                type="button"
                onClick={voice.disconnect}
              >
                <PhoneOff className="size-8 text-rose-200" />
              </button>
            )}

            <button
              aria-label="Start a new conversation"
              className={cn(
                glass(),
                "flex size-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground"
              )}
              disabled={sessionLocked}
              title={
                sessionLocked
                  ? "End the session to start a new conversation"
                  : "Start a fresh conversation instead of resuming"
              }
              type="button"
              onClick={voice.startNew}
            >
              <Plus className="size-4" />
            </button>

            <button
              aria-label="Reset voice session"
              className={cn(
                glass(),
                "flex size-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              )}
              type="button"
              onClick={voice.resetSession}
            >
              <RotateCcw className="size-4" />
            </button>
          </div>

          {modalities.text && voice.transcript.length > 0 ? (
            <div className="mt-8 max-h-40 w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-left text-xs text-muted-foreground">
              {voice.transcript.map((t) => (
                <p key={t.id} className="mb-1">
                  <span className="font-medium text-foreground/80">{t.role}: </span>
                  {t.text}
                </p>
              ))}
            </div>
          ) : null}

          {onExit ? (
            <button
              className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              type="button"
              onClick={onExit}
            >
              Read text aloud instead
            </button>
          ) : null}
        </div>

        {showVisualPanel ? (
          <SpeakVisualPanel
            genUiBlocks={genUiBlocks}
            showGenUi={modalities.genUi}
            showWeb={modalities.web}
            uiStateBySurface={uiStateBySurface}
            webPreview={webPreview}
          />
        ) : null}
      </div>
    </div>
  );
}
