"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSpeakSessionPhase } from "@/lib/arcadia/multitask/speak-session";
import type { LiveVoicePhase } from "@/hooks/use-realtime-voice";

import Link from "next/link";

import { Radio } from "lucide-react";

import { SubagentSpeakGlassBar } from "./subagent-speak-glass-bar";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ArcadiaSubagent["status"], string> = {
  idle: "Idle",
  working: "Working",
  blocked: "Blocked",
  done: "Done",
};

type SubagentCardProps = {
  agent: ArcadiaSubagent;
  selected: boolean;
  speakPhase: ArcadiaSpeakSessionPhase;
  voicePhase: LiveVoicePhase;
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onSelect: () => void;
  onSpeakTo: () => void;
  onEndSpeak: () => void;
  speakDisabled?: boolean;
};

/**
 * Condensed main character for one active subagent — not a status chip, not a full page.
 */
export function SubagentCard({
  agent,
  selected,
  speakPhase,
  voicePhase,
  startedAt,
  localStream,
  remoteStream,
  onSelect,
  onSpeakTo,
  onEndSpeak,
  speakDisabled,
}: SubagentCardProps) {
  const speaking = speakPhase === "live" || speakPhase === "connecting";

  return (
    <article
      className={cn(
        glass({ tone: "brown", opaque: true }),
        "rounded-xl border p-3 transition-colors",
        selected
          ? "border-amber-700/40 dark:border-amber-200/25 ring-1 ring-amber-800/20"
          : "border-border/50 hover:border-border"
      )}
    >
      <button className="w-full text-left" type="button" onClick={onSelect}>
        <div className="flex items-start gap-3">
          {/* Identity image slot — leave intact for non-human portraits from other work. */}
          <div
            aria-hidden={agent.identityImageUrl ? undefined : true}
            className="size-10 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-background/50"
          >
            {agent.identityImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- sandbox identity slot; URL may be data: or remote
              <img alt="" className="size-full object-cover" src={agent.identityImageUrl} />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold tracking-tight text-foreground">
                    {agent.name}
                  </h3>
                  {speaking ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      <Radio aria-hidden className="size-3" />
                      Live
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {agent.role} · voice {agent.voiceId}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  agent.status === "working" &&
                    "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                  agent.status === "idle" && "bg-muted text-muted-foreground",
                  agent.status === "blocked" &&
                    "bg-amber-500/15 text-amber-900 dark:text-amber-100",
                  agent.status === "done" && "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                )}
              >
                {STATUS_LABEL[agent.status]}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm leading-snug text-foreground/90">{agent.blurb}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {agent.goal}
        </p>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Progress</span>
            <span>{agent.progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
            <div
              className="h-full rounded-full bg-amber-800/70 dark:bg-amber-200/50 transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, agent.progressPct))}%` }}
            />
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{agent.progress}</p>
        </div>
      </button>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {agent.threadId ? <Link
          href={`/sandbox/arcadia/${agent.threadId}`}
          className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-center text-xs font-medium hover:bg-background-secondary focus-visible:outline focus-visible:outline-2"
        >
          Open thread
        </Link> : <button
          className={cn(
            "rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-xs font-medium",
            "hover:bg-background-secondary transition-colors sm:w-auto sm:shrink-0",
            selected && "border-amber-800/30"
          )}
          type="button"
          onClick={onSelect}
        >
          View agent
        </button>}
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
    </article>
  );
}
