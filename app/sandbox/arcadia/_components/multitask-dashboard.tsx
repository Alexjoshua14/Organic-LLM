"use client";

import type { CSSProperties, ReactNode } from "react";

import { Layers3, Play, X } from "lucide-react";

import { MultitaskSidebarGate } from "./multitask-sidebar-gate";
import { SubagentCard } from "./subagent-card";
import { SubagentDetail } from "./subagent-detail";
import { useArcadiaMultitask } from "./multitask-provider";
import { SendTargetPicker } from "./send-target-picker";
import { VoiceRosterLegend } from "./voice-roster-legend";

import { glass } from "@/components/design-system/primitives";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import {
  isArcadiaSubagentRunning,
  MULTITASK_DASHBOARD_WIDE_MIN_PX,
  MULTITASK_DESKTOP_AGENT_COL_MAX_PX,
  MULTITASK_DESKTOP_AGENT_COL_MIN_PX,
  MULTITASK_DESKTOP_GUTTER_PX,
  MULTITASK_DESKTOP_PAD_BOTTOM_PX,
  MULTITASK_DESKTOP_PAD_TOP_PX,
  MULTITASK_DESKTOP_PAD_X_PX,
} from "@/lib/arcadia/multitask/layout-mode";
import { resolveSpeakBarPhase } from "@/lib/arcadia/multitask/speak-session";
import { cn } from "@/lib/utils";

type MultitaskDashboardProps = {
  children: ReactNode;
};

/**
 * User-toggled multiagent layout.
 *
 * Mobile (&lt; {@link MULTITASK_DASHBOARD_WIDE_MIN_PX}): board scrolls above a docked chat
 * stack (Send to + composer). Nothing paints over anything else.
 * Wide: chat (main) beside a narrower agent board — calm gutter, no hard seam.
 */
export function MultitaskDashboard({ children }: MultitaskDashboardProps) {
  const voice = useVoiceSessionOptional();
  const {
    agents,
    selected,
    selectedId,
    liveSpeakAgentId,
    closingSpeakAgentId,
    shellOpen,
    setShellOpen,
    selectAgent,
    speakTo,
    endSpeak,
    tickDemo,
    sendTarget,
    setSendTarget,
    toggleMultitaskView,
    toggleBlockedReason,
  } = useArcadiaMultitask();

  const speakDisabled = !voice;
  const runningCount = agents.filter(isArcadiaSubagentRunning).length;
  const voicePhase = voice?.phase ?? "idle";
  const startedAt = voice?.startedAt ?? null;
  const localStream = voice?.localStream ?? null;
  const remoteStream = voice?.remoteStream ?? null;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-x-hidden"
      style={
        {
          ["--multitask-wide-min" as string]: `${MULTITASK_DASHBOARD_WIDE_MIN_PX}px`,
          ["--multitask-pad-top" as string]: `${MULTITASK_DESKTOP_PAD_TOP_PX}px`,
          ["--multitask-pad-x" as string]: `${MULTITASK_DESKTOP_PAD_X_PX}px`,
          ["--multitask-pad-bottom" as string]: `${MULTITASK_DESKTOP_PAD_BOTTOM_PX}px`,
          ["--multitask-gutter" as string]: `${MULTITASK_DESKTOP_GUTTER_PX}px`,
          ["--multitask-agent-min" as string]: `${MULTITASK_DESKTOP_AGENT_COL_MIN_PX}px`,
          ["--multitask-agent-max" as string]: `${MULTITASK_DESKTOP_AGENT_COL_MAX_PX}px`,
          paddingTop: "max(var(--multitask-pad-top), env(safe-area-inset-top, 0px))",
          paddingLeft: "var(--multitask-pad-x)",
          paddingRight: "var(--multitask-pad-x)",
          paddingBottom: "var(--multitask-pad-bottom)",
        } as CSSProperties
      }
    >
      <MultitaskSidebarGate dashboardOpen />

      <header className="flex shrink-0 items-start justify-between gap-3 pb-3">
        <div className="min-w-0 flex-1 pr-2">
          <h1 className="truncate text-sm font-semibold tracking-tight">Multitask dashboard</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {runningCount} running · pick who you write to
          </p>
          {toggleBlockedReason ? (
            <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200">
              {toggleBlockedReason}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/50 px-2 py-1 text-[11px] hover:bg-background-secondary"
            title="Advance demo progress once"
            type="button"
            onClick={() => tickDemo()}
          >
            <Play aria-hidden className="size-3" />
            Tick
          </button>
          <button
            aria-expanded={shellOpen}
            className={cn(
              glass({ tone: "brown", opaque: true }),
              "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1.5 text-xs font-medium"
            )}
            type="button"
            onClick={() => setShellOpen(!shellOpen)}
          >
            <Layers3 aria-hidden className="size-3.5" />
            {shellOpen ? "Hide board" : "Show board"}
          </button>
          <button
            className={cn(
              glass({ opaque: true }),
              "inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1.5 text-xs font-medium"
            )}
            type="button"
            onClick={() => void toggleMultitaskView()}
          >
            <X aria-hidden className="size-3.5" />
            Exit
          </button>
        </div>
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          "gap-3",
          // Chat (1fr) first — main interaction. Agent board capped so it cannot out-width chat.
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(var(--multitask-agent-min),var(--multitask-agent-max))] lg:gap-[var(--multitask-gutter)]"
        )}
      >
        <section
          aria-label="Confined orchestrator chat"
          className={cn(
            glass({ tone: "brown", opaque: true }),
            "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/40",
            shellOpen
              ? "h-[min(46dvh,22rem)] shrink-0 lg:order-1 lg:h-auto lg:min-h-0 lg:flex-1"
              : "min-h-0 flex-1 lg:order-1"
          )}
        >
          <div className="shrink-0 border-b border-border/30 bg-background/95 p-3">
            <SendTargetPicker agents={agents} sendTarget={sendTarget} onChange={setSendTarget} />
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden [&_[data-arcadia-chat-root]]:h-full">
            {children}
          </div>
        </section>

        {shellOpen ? (
          <section
            aria-label="Subagent board"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:order-2 lg:h-full"
          >
            <div className="space-y-4 pb-2">
              {agents.map((agent) => {
                const speakPhase = resolveSpeakBarPhase({
                  agentId: agent.id,
                  liveAgentId: liveSpeakAgentId,
                  closingAgentId: closingSpeakAgentId,
                  voiceConnecting: !!voice?.connecting,
                  voiceConnected: !!voice?.connected,
                });

                return (
                  <SubagentCard
                    key={agent.id}
                    agent={agent}
                    localStream={liveSpeakAgentId === agent.id ? localStream : null}
                    remoteStream={liveSpeakAgentId === agent.id ? remoteStream : null}
                    selected={selectedId === agent.id}
                    speakDisabled={speakDisabled && speakPhase === "idle"}
                    speakPhase={speakPhase}
                    startedAt={liveSpeakAgentId === agent.id ? startedAt : null}
                    voicePhase={voicePhase}
                    onEndSpeak={endSpeak}
                    onSelect={() => selectAgent(agent.id)}
                    onSpeakTo={() => void speakTo(agent.id)}
                  />
                );
              })}
              {selected ? (
                <SubagentDetail
                  agent={selected}
                  localStream={liveSpeakAgentId === selected.id ? localStream : null}
                  remoteStream={liveSpeakAgentId === selected.id ? remoteStream : null}
                  speakDisabled={
                    speakDisabled &&
                    resolveSpeakBarPhase({
                      agentId: selected.id,
                      liveAgentId: liveSpeakAgentId,
                      closingAgentId: closingSpeakAgentId,
                      voiceConnecting: !!voice?.connecting,
                      voiceConnected: !!voice?.connected,
                    }) === "idle"
                  }
                  speakPhase={resolveSpeakBarPhase({
                    agentId: selected.id,
                    liveAgentId: liveSpeakAgentId,
                    closingAgentId: closingSpeakAgentId,
                    voiceConnecting: !!voice?.connecting,
                    voiceConnected: !!voice?.connected,
                  })}
                  startedAt={liveSpeakAgentId === selected.id ? startedAt : null}
                  voicePhase={voicePhase}
                  onClose={() => selectAgent(null)}
                  onEndSpeak={endSpeak}
                  onSpeakTo={() => void speakTo(selected.id)}
                />
              ) : (
                <p className="px-1 text-xs text-muted-foreground">
                  Tap a subagent to open their thread, or Speak to start a Realtime session.
                </p>
              )}
              <VoiceRosterLegend />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
