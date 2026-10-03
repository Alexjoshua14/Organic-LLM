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
      <header className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{agent.name}</h2>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {agent.role} · Realtime voice <span className="font-mono">{agent.voiceId}</span>
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">Goal</h3>
          <p className="mt-1 text-sm leading-relaxed">{agent.goal}</p>
        </section>
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Current progress · {agent.progressPct}%
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">{agent.progress}</p>
        </section>
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">Milestones</h3>
          {agent.milestones.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              None yet — Speak only announces these.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
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
        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Speak contract
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Speak to starts a new Realtime session in this voice, seeded with goal + progress.
            Background progress is silent; milestones are announced. Only one Speak session at a
            time — choosing another agent ends the current call first.
          </p>
        </section>
      </div>

      <footer className="border-t border-border/50 p-3">
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
