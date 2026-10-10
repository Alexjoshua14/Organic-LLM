"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSpeakSessionPhase } from "@/lib/arcadia/multitask/speak-session";
import type { CSSProperties } from "react";

import Link from "next/link";
import { Mic, Radio } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import {
  MULTITASK_CONDENSED_CARD_GAP_PX,
  MULTITASK_CONDENSED_CARD_WIDTH_PX,
} from "@/lib/arcadia/multitask/layout-mode";
import { cn } from "@/lib/utils";
import { getModelDisplayName } from "@/lib/chat/message-model";

const STATUS_DOT: Record<ArcadiaSubagent["status"], string> = {
  idle: "bg-muted-foreground/40",
  working: "bg-emerald-500",
  blocked: "bg-amber-500",
  done: "bg-sky-500",
};

const STATUS_LABEL: Record<ArcadiaSubagent["status"], string> = {
  idle: "Idle",
  working: "Working",
  blocked: "Blocked",
  done: "Done",
};

type CompactCardProps = {
  agent: ArcadiaSubagent;
  /** This agent is the composer's current send target. */
  targeted: boolean;
  speakPhase: ArcadiaSpeakSessionPhase;
  speakDisabled: boolean;
  onTarget: () => void;
  onSpeakTo: () => void;
  onEndSpeak: () => void;
};

/**
 * Condensed-layout subagent card: identity, status, one line of progress. Opens the subagent's
 * thread when it has one; otherwise addresses the composer to it.
 */
function SubagentCompactCard({
  agent,
  targeted,
  speakPhase,
  speakDisabled,
  onTarget,
  onSpeakTo,
  onEndSpeak,
}: CompactCardProps) {
  const speaking = speakPhase === "live" || speakPhase === "connecting";
  const modelName = getModelDisplayName(agent.modelId);
  const body = (
    <>
      <div className="flex items-center gap-2 pr-7">
        <div
          aria-hidden
          className="size-7 shrink-0 overflow-hidden rounded-md border border-border/40 bg-background/50"
        >
          {agent.identityImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- sandbox identity slot; URL may be data: or remote
            <img alt="" className="size-full object-cover" src={agent.identityImageUrl} />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight">
            {agent.name}
          </p>
          <p className="flex items-center gap-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            <span
              aria-hidden
              className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[agent.status])}
            />
            <span className="sr-only">{STATUS_LABEL[agent.status]}, </span>
            {agent.role}
          </p>
        </div>
      </div>
      <p
        className="mt-1 truncate text-[10px] leading-snug text-muted-foreground/70"
        title={agent.modelId ?? undefined}
      >
        <span className="text-muted-foreground/50">LLM · </span>
        {modelName ?? (agent.threadId ? "Not recorded" : "Not assigned")}
      </p>
      <p className="mt-1.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground">
        {agent.status === "idle" ? agent.blurb : agent.progress || agent.goal}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background/60">
        <div
          className="h-full rounded-full bg-amber-800/70 transition-[width] duration-500 dark:bg-amber-200/50"
          style={{ width: `${Math.min(100, Math.max(0, agent.progressPct))}%` }}
        />
      </div>
    </>
  );
  const surface =
    "block w-full rounded-xl p-2.5 text-left focus-visible:outline focus-visible:outline-2";

  return (
    <article
      className={cn(
        glass({ tone: "brown", opaque: true }),
        "relative rounded-xl border transition-colors",
        targeted || speaking
          ? "border-amber-700/40 ring-1 ring-amber-800/20 dark:border-amber-200/25"
          : "border-border/50"
      )}
      style={{ width: MULTITASK_CONDENSED_CARD_WIDTH_PX }}
    >
      {agent.threadId ? (
        <Link
          aria-label={`Open ${agent.name}'s thread`}
          className={surface}
          href={`/sandbox/arcadia/${agent.threadId}`}
        >
          {body}
        </Link>
      ) : (
        <button
          aria-label={targeted ? `Stop addressing ${agent.name}` : `Address ${agent.name}`}
          aria-pressed={targeted}
          className={surface}
          type="button"
          onClick={onTarget}
        >
          {body}
        </button>
      )}
      <button
        aria-label={speaking ? `End call with ${agent.name}` : `Speak to ${agent.name}`}
        className={cn(
          "absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-lg",
          "text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-40",
          speaking && "text-amber-800 dark:text-amber-200"
        )}
        disabled={speakDisabled && !speaking}
        type="button"
        onClick={speaking ? onEndSpeak : onSpeakTo}
      >
        {speaking ? (
          <Radio aria-hidden className="size-3.5" />
        ) : (
          <Mic aria-hidden className="size-3.5" />
        )}
      </button>
    </article>
  );
}

type SubagentSwipeRowProps = {
  agents: ReadonlyArray<ArcadiaSubagent>;
  targetedAgentId: string | null;
  speakPhaseFor: (agentId: string) => ArcadiaSpeakSessionPhase;
  speakDisabled: boolean;
  onTarget: (agentId: string) => void;
  onSpeakTo: (agentId: string) => void;
  onEndSpeak: () => void;
};

/** Horizontal, snap-scrolling row of compact subagent cards for the condensed dashboard. */
export function SubagentSwipeRow({
  agents,
  targetedAgentId,
  speakPhaseFor,
  speakDisabled,
  onTarget,
  onSpeakTo,
  onEndSpeak,
}: SubagentSwipeRowProps) {
  if (agents.length === 0) return null;

  return (
    <div
      aria-label="Subagents"
      className={cn(
        "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-0.5",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
      role="list"
      style={{ gap: MULTITASK_CONDENSED_CARD_GAP_PX } as CSSProperties}
    >
      {agents.map((agent) => (
        <div key={agent.id} className="shrink-0 snap-start" role="listitem">
          <SubagentCompactCard
            agent={agent}
            speakDisabled={speakDisabled}
            speakPhase={speakPhaseFor(agent.id)}
            targeted={targetedAgentId === agent.id}
            onEndSpeak={onEndSpeak}
            onSpeakTo={() => onSpeakTo(agent.id)}
            onTarget={() => onTarget(agent.id)}
          />
        </div>
      ))}
    </div>
  );
}
