"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSpeakSessionPhase } from "@/lib/arcadia/multitask/speak-session";
import type { LiveVoicePhase } from "@/hooks/use-realtime-voice";

import { SubagentSpeakGlassBar } from "./subagent-speak-glass-bar";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type SubagentDetailProps = {
  agent: ArcadiaSubagent;
  speakPhase: ArcadiaSpeakSessionPhase;
  voicePhase: LiveVoicePhase;
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onSpeakTo: () => void;
  onEndSpeak: () => void;
  onClose: () => void;
  speakDisabled?: boolean;
};

/** Expanded interaction panel for one condensed main character. */
export function SubagentDetail({
  agent,
  speakPhase,
  voicePhase,
  startedAt,
  localStream,
  remoteStream,
  onSpeakTo,
  onEndSpeak,
  onClose,
  speakDisabled,
}: SubagentDetailProps) {
  const speaking = speakPhase === "live" || speakPhase === "connecting";

  return (
    <aside
      className={cn(
        glass({ tone: "brown", opaque: true }),
        "flex h-full min-h-0 flex-col rounded-xl border border-border/60"
      )}
    >
      <header className="flex items-start justify-between gap-inline-md border-b border-border/50 px-inset-lg py-inset-md">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{agent.name}</h2>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {agent.role}
            {speaking ? " · speaking now" : ""}
          </p>
        </div>
        <button
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background/60"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-stack-md overflow-y-auto px-inset-lg py-inset-md">
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">Goal</h3>
          <p className="mt-stack-xs text-sm leading-snug">{agent.goal}</p>
        </section>
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Current progress
          </h3>
          <p className="mt-stack-xs text-sm leading-snug text-foreground/90">{agent.progress}</p>
        </section>
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">Milestones</h3>
          {agent.milestones.length === 0 ? (
            <p className="mt-stack-xs text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-stack-sm space-y-stack-sm">
              {[...agent.milestones].reverse().map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
                >
                  {m.label}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="border-t border-border/50 p-inset-md">
        <SubagentSpeakGlassBar
          agentName={agent.name}
          disabled={speakDisabled}
          localStream={localStream}
          phase={speakPhase}
          remoteStream={remoteStream}
          startedAt={startedAt}
          voicePhase={voicePhase}
          onEnd={onEndSpeak}
          onSpeakTo={onSpeakTo}
        />
      </footer>
    </aside>
  );
}
