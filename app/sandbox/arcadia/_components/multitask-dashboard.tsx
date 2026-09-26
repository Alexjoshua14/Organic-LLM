"use client";

import type { ReactNode } from "react";

import { Layers3, Play } from "lucide-react";

import { SubagentCard } from "./subagent-card";
import { SubagentDetail } from "./subagent-detail";
import { useArcadiaMultitask } from "./multitask-provider";
import { SendTargetPicker } from "./send-target-picker";
import { VoiceRosterLegend } from "./voice-roster-legend";

import { glass } from "@/components/design-system/primitives";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { isArcadiaSubagentRunning } from "@/lib/arcadia/multitask/layout-mode";
import { cn } from "@/lib/utils";

type MultitaskDashboardProps = {
  /** Full Arcadia Chat tree — rendered inside the confined pane. */
  children: ReactNode;
};

/**
 * Running-state layout: confined chat + explicit send target + live subagent board.
 * Composer stays enabled; destination is chosen via {@link SendTargetPicker}.
 */
export function MultitaskDashboard({ children }: MultitaskDashboardProps) {
  const voice = useVoiceSessionOptional();
  const {
    agents,
    selected,
    selectedId,
    speakBinding,
    shellOpen,
    setShellOpen,
    selectAgent,
    speakTo,
    tickDemo,
    sendTarget,
    setSendTarget,
  } = useArcadiaMultitask();

  const speakDisabled = !voice || voice.connecting;
  const runningCount = agents.filter(isArcadiaSubagentRunning).length;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-3 p-2 sm:p-3">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">Multitask dashboard</h1>
          <p className="text-[11px] text-muted-foreground">
            {runningCount} running · chat confined · pick who you write to
          </p>
        </div>
        <div className="flex items-center gap-1.5">
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
              "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium"
            )}
            type="button"
            onClick={() => setShellOpen(!shellOpen)}
          >
            <Layers3 aria-hidden className="size-3.5" />
            {shellOpen ? "Hide board" : "Show board"}
          </button>
        </div>
      </header>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3",
          shellOpen ? "grid-cols-1 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]" : "grid-cols-1"
        )}
      >
        <section
          aria-label="Confined orchestrator chat"
          className={cn(
            glass({ tone: "brown", opaque: true }),
            "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60",
            shellOpen ? "order-2 lg:order-1 max-h-[42vh] lg:max-h-none" : "order-1"
          )}
        >
          <div className="shrink-0 border-b border-border/40 p-2.5">
            <SendTargetPicker agents={agents} sendTarget={sendTarget} onChange={setSendTarget} />
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden [&_[data-arcadia-chat-root]]:h-full">
            {children}
          </div>
        </section>

        {shellOpen ? (
          <section
            aria-label="Subagent board"
            className="order-1 flex min-h-0 flex-col gap-3 overflow-hidden lg:order-2"
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="min-h-0 space-y-3 overflow-y-auto pr-0.5">
                {agents.map((agent) => (
                  <SubagentCard
                    key={agent.id}
                    agent={agent}
                    selected={selectedId === agent.id}
                    speakDisabled={speakDisabled}
                    speaking={speakBinding?.agentId === agent.id && !!voice?.connected}
                    onSelect={() => selectAgent(agent.id)}
                    onSpeakTo={() => void speakTo(agent.id)}
                  />
                ))}
                <VoiceRosterLegend />
              </div>
              <div className="min-h-0">
                {selected ? (
                  <SubagentDetail
                    agent={selected}
                    speakDisabled={speakDisabled}
                    speaking={speakBinding?.agentId === selected.id && !!voice?.connected}
                    onClose={() => selectAgent(null)}
                    onSpeakTo={() => void speakTo(selected.id)}
                  />
                ) : (
                  <div
                    className={cn(
                      glass({ opaque: true }),
                      "flex h-full min-h-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-6 text-center"
                    )}
                  >
                    <p className="text-sm font-medium">Select a subagent</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Open their thread to write to them, or Speak to start a Realtime session.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
