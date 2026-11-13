"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { RealtimeTranscriptEntry } from "@/hooks/use-realtime-voice";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";
import type { SpeakPrimaryAction, SpeakStageStatus } from "@/lib/speak/speak-stage-view";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, MessageSquareText, Mic, MicOff, Phone, PhoneOff, Plus, X } from "lucide-react";

import { KaraokeCaption } from "./KaraokeCaption";
import { SpeakModeSwitch } from "./SpeakModeSwitch";
import { SpeakBudgetMeter } from "./SpeakBudgetMeter";
import { SpeakOrb } from "./SpeakOrb";
import { SpeakTranscript } from "./SpeakTranscript";
import {
  SPEAK_PANEL_ENTER_MS,
  SPEAK_PANEL_EXIT_MS,
  SPEAK_STAGE_EASE,
  SPEAK_STATUS_ENTER_MS,
  SPEAK_STATUS_EXIT_MS,
} from "./speak-stage-timing";

import { glass } from "@/components/design-system/primitives";
import { VoiceElapsed } from "@/components/voice/voice-elapsed";
import { SPEAK_PRIMARY_ACTION_LABEL } from "@/lib/speak/speak-stage-view";
import { cn } from "@/lib/utils";

export type SpeakStageCaption = {
  role: "user" | "assistant" | "system";
  text: string;
  interim?: boolean;
};

export type SpeakStageProps = {
  status: SpeakStageStatus;
  primaryAction: SpeakPrimaryAction;
  onPrimary: () => void;
  muted: boolean;
  onToggleMute: () => void;
  canStartNew: boolean;
  onStartNew: () => void;
  onSwitchToReadAloud?: () => void;

  /** Epoch ms the call began; `null` when not live. */
  startedAt: number | null;
  budget: SpeakBudgetSnapshot | null;
  /** "Continuing …" while a resumed call is live. */
  contextLine: string | null;
  memoryEnabled: boolean;

  caption: SpeakStageCaption | null;
  transcript: RealtimeTranscriptEntry[];
  transcriptAvailable: boolean;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  /** Supporting visuals (cards, web page). When present the panel gains a Visuals tab. */
  visuals?: ReactNode;

  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  /** Replaces the orb, e.g. the persona Spark. */
  presence?: ReactNode;
  /** Persona turn label, starters and similar, under the status. */
  statusExtra?: ReactNode;
  /** Header slots. */
  personaChip?: ReactNode;
  settings: ReactNode;
};

/**
 * The Speak stage. Presentational: every value arrives as a prop, so the sandbox lab renders
 * this exact component in each state without a microphone or a paid session.
 *
 * Layout, top to bottom: header (mode, allowance, settings), presence (orb + one status word +
 * one sentence), live caption, and a thumb-reach dock with exactly three controls. The
 * transcript and visuals live in a side panel on wide screens and a sheet on phones.
 */
export function SpeakStage(props: SpeakStageProps) {
  const {
    status,
    primaryAction,
    onPrimary,
    muted,
    onToggleMute,
    canStartNew,
    onStartNew,
    onSwitchToReadAloud,
    startedAt,
    budget,
    contextLine,
    memoryEnabled,
    caption,
    transcript,
    transcriptAvailable,
    panelOpen,
    onPanelOpenChange,
    visuals,
    localStream,
    remoteStream,
    presence,
    statusExtra,
    personaChip,
    settings,
  } = props;
  const reduceMotion = useReducedMotion();
  const live = status.live;
  const hasPanel = transcriptAvailable || Boolean(visuals);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-inline-sm px-inset-lg pt-[max(env(safe-area-inset-top,0px),1rem)]">
        <div className="flex min-w-0 items-center gap-inline-sm">
          {onSwitchToReadAloud ? (
            <SpeakModeSwitch mode="live" onChange={onSwitchToReadAloud} />
          ) : null}
          {personaChip}
        </div>
        <div className="flex items-center gap-inline-sm">
          <SpeakBudgetMeter budget={budget} className="hidden sm:flex" />
          {hasPanel ? (
            <button
              aria-expanded={panelOpen}
              aria-keyshortcuts="T"
              aria-label={panelOpen ? "Hide transcript" : "Show transcript"}
              className={cn(
                glass({ border: "all" }),
                "flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                panelOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title={panelOpen ? "Hide transcript (T)" : "Show transcript (T)"}
              type="button"
              onClick={() => onPanelOpenChange(!panelOpen)}
            >
              <MessageSquareText aria-hidden className="size-4" />
            </button>
          ) : null}
          {settings}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <section
          aria-label="Voice call"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-inset-lg"
        >
          <LivePill live={live} startedAt={startedAt} />

          <div className="flex flex-col items-center gap-stack-2xl">
            {presence ?? (
              <SpeakOrb
                localStream={localStream}
                remoteStream={remoteStream}
                status={status.kind}
              />
            )}

            <div className="flex min-h-[4.5rem] max-w-md flex-col items-center gap-stack-xs text-center">
              <AnimatePresence initial={false} mode="wait">
                <motion.p
                  key={status.kind}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "font-commissioner text-2xl font-light tracking-tight sm:text-3xl",
                    status.kind === "error" ? "text-rose-300" : "text-foreground"
                  )}
                  exit={{
                    opacity: 0,
                    y: reduceMotion ? 0 : -4,
                    transition: { duration: reduceMotion ? 0 : SPEAK_STATUS_EXIT_MS / 1000 },
                  }}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                  transition={{
                    duration: reduceMotion ? 0 : SPEAK_STATUS_ENTER_MS / 1000,
                    ease: SPEAK_STAGE_EASE,
                  }}
                >
                  {status.label}
                </motion.p>
              </AnimatePresence>
              <p
                aria-live="polite"
                className="text-sm leading-snug text-muted-foreground"
                role={status.kind === "error" ? "alert" : "status"}
              >
                <span className="sr-only">{status.label}. </span>
                {status.detail}
              </p>
              {statusExtra}
            </div>
          </div>

          {caption && caption.text ? (
            <div className="mt-stack-2xl w-full max-w-2xl">
              <KaraokeCaption interim={caption.interim} role={caption.role} text={caption.text} />
            </div>
          ) : null}
        </section>

        <SidePanel
          open={hasPanel && panelOpen}
          reduceMotion={Boolean(reduceMotion)}
          transcript={transcript}
          transcriptAvailable={transcriptAvailable}
          visuals={visuals}
          onClose={() => onPanelOpenChange(false)}
        />
      </div>

      <footer className="relative z-20 flex shrink-0 flex-col items-center gap-stack-sm px-inset-lg pb-[max(env(safe-area-inset-bottom,0px),1.25rem)] pt-stack-md">
        <div className="flex items-center gap-inline-lg">
          <DockButton
            disabled={!live}
            keyShortcut="M"
            label={muted ? "Unmute microphone" : "Mute microphone"}
            pressed={muted}
            onClick={onToggleMute}
          >
            {muted ? (
              <MicOff aria-hidden className="size-5" />
            ) : (
              <Mic aria-hidden className="size-5" />
            )}
          </DockButton>

          <PrimaryButton action={primaryAction} onClick={onPrimary} />

          <DockButton
            disabled={!canStartNew}
            label="Start a new conversation"
            title={
              canStartNew
                ? "Start fresh instead of continuing your last conversation"
                : "End the call to start a new conversation"
            }
            onClick={onStartNew}
          >
            <Plus aria-hidden className="size-5" />
          </DockButton>
        </div>

        <ContextLine contextLine={contextLine} memoryEnabled={memoryEnabled} live={live} />
      </footer>
    </div>
  );
}

function LivePill({ live, startedAt }: { live: boolean; startedAt: number | null }) {
  return (
    <div className="mb-stack-2xl flex h-7 items-center">
      {live && startedAt ? (
        <span
          className={cn(
            glass({ border: "all" }),
            "flex h-7 items-center gap-1.5 rounded-full px-inset-md text-xs"
          )}
        >
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-foreground/90">Live</span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <VoiceElapsed startedAt={startedAt} />
        </span>
      ) : null}
    </div>
  );
}

/** Blocks a button's native Space activation; the window-level shortcut still sees the key. */
function swallowSpaceActivation(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key === " " || event.key === "Spacebar") event.preventDefault();
}

function PrimaryButton({ action, onClick }: { action: SpeakPrimaryAction; onClick: () => void }) {
  const label = SPEAK_PRIMARY_ACTION_LABEL[action];
  const ending = action === "end";

  return (
    <button
      aria-label={label}
      className={cn(
        "flex size-[4.5rem] items-center justify-center rounded-full shadow-lg transition-[transform,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-wait",
        ending
          ? "bg-rose-500 text-white shadow-rose-500/30 hover:bg-rose-500/90"
          : "bg-foreground text-background shadow-foreground/20 hover:scale-[1.04] motion-reduce:hover:scale-100"
      )}
      // Focus stays on this button after it starts a call, and then it becomes End. Space must
      // not hang up (the stage maps it to mute), so it passes through; Enter still ends.
      data-speak-space-passthrough={ending ? "" : undefined}
      disabled={action === "connecting"}
      title={action === "start" || action === "resume" ? `${label} (Space)` : label}
      type="button"
      onClick={onClick}
      onKeyDown={ending ? swallowSpaceActivation : undefined}
      onKeyUp={ending ? swallowSpaceActivation : undefined}
    >
      {action === "connecting" ? (
        <Loader2 aria-hidden className="size-7 animate-spin" />
      ) : ending ? (
        <PhoneOff aria-hidden className="size-7" />
      ) : (
        <Phone aria-hidden className="size-7" />
      )}
    </button>
  );
}

function DockButton({
  label,
  title,
  disabled,
  pressed,
  keyShortcut,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  pressed?: boolean;
  keyShortcut?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-keyshortcuts={keyShortcut}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        glass({ border: "all" }),
        "flex size-14 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        pressed
          ? "bg-foreground/[0.14] text-foreground"
          : "text-muted-foreground enabled:hover:text-foreground"
      )}
      disabled={disabled}
      title={title ?? (keyShortcut ? `${label} (${keyShortcut})` : label)}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ContextLine({
  contextLine,
  memoryEnabled,
  live,
}: {
  contextLine: string | null;
  memoryEnabled: boolean;
  live: boolean;
}) {
  return (
    <div className="flex min-h-4 flex-wrap items-center justify-center gap-x-inline-sm text-2xs text-muted-foreground">
      {contextLine ? <span className="max-w-[18rem] truncate">{contextLine}</span> : null}
      {contextLine ? <span aria-hidden>·</span> : null}
      <span>{memoryEnabled ? "Memory on" : "Memory off"}</span>
      <span aria-hidden className="hidden md:inline">
        ·
      </span>
      <span className="hidden md:inline">
        {live ? "Space to mute · T for transcript" : "Space to start · T for transcript"}
      </span>
    </div>
  );
}

function SidePanel({
  open,
  reduceMotion,
  transcript,
  transcriptAvailable,
  visuals,
  onClose,
}: {
  open: boolean;
  reduceMotion: boolean;
  transcript: RealtimeTranscriptEntry[];
  transcriptAvailable: boolean;
  visuals?: ReactNode;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"transcript" | "visuals">(
    transcriptAvailable ? "transcript" : "visuals"
  );
  const activeTab = !visuals ? "transcript" : !transcriptAvailable ? "visuals" : tab;

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          animate={{ opacity: 1, x: 0, y: 0 }}
          aria-label="Call details"
          className={cn(
            glass({ opaque: true, border: "all" }),
            // Phone: a sheet over the lower stage. Wide screens: a column beside it.
            "absolute inset-x-2 bottom-0 top-[28%] z-30 flex flex-col overflow-hidden rounded-3xl shadow-2xl",
            "lg:static lg:inset-auto lg:my-2 lg:mr-inset-lg lg:w-[24rem] lg:shrink-0 lg:shadow-none"
          )}
          exit={{
            opacity: 0,
            y: reduceMotion ? 0 : 16,
            transition: { duration: reduceMotion ? 0 : SPEAK_PANEL_EXIT_MS / 1000 },
          }}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
          transition={{
            duration: reduceMotion ? 0 : SPEAK_PANEL_ENTER_MS / 1000,
            ease: SPEAK_STAGE_EASE,
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-inline-sm border-b border-border/50 px-inset-md py-1.5">
            {visuals && transcriptAvailable ? (
              <div aria-label="Panel" className="flex items-center gap-1" role="tablist">
                <PanelTab active={activeTab === "transcript"} onClick={() => setTab("transcript")}>
                  Transcript
                </PanelTab>
                <PanelTab active={activeTab === "visuals"} onClick={() => setTab("visuals")}>
                  Visuals
                </PanelTab>
              </div>
            ) : (
              <p className="px-1 text-xs font-medium text-foreground">
                {activeTab === "transcript" ? "Transcript" : "Visuals"}
              </p>
            )}
            <button
              aria-label="Close panel"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {activeTab === "transcript" ? (
              <SpeakTranscript className="flex-1" entries={transcript} />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-inset-md">{visuals}</div>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "flex h-9 items-center rounded-full px-inset-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-foreground/[0.1] text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
      role="tab"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
