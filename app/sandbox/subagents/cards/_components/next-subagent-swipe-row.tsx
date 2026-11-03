"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSpeakSessionPhase } from "@/lib/arcadia/multitask/speak-session";
import type { CSSProperties } from "react";

import Link from "next/link";
import { AudioLines, ChevronDown, Radio } from "lucide-react";
import { useId, useState } from "react";

import { glass } from "@/components/design-system/primitives";
import { SubagentIdentityMark } from "@/components/agents/subagent-identity-mark";
import {
  MULTITASK_CONDENSED_CARD_GAP_PX,
  MULTITASK_CONDENSED_CARD_WIDTH_PX,
} from "@/lib/arcadia/multitask/layout-mode";
import { cn } from "@/lib/utils";
import { getModelDisplayName } from "@/lib/chat/message-model";

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
 * NEXT version, the working fork. Design changes land here first; "promote" copies this over the
 * live component and keeps this file. See docs/design/subagent-card-lab.md.
 *
 * Condensed-layout subagent card: identity, status, and model. Opens the subagent's
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
        <SubagentIdentityMark
          className="size-9 rounded-md"
          imageUrl={agent.identityImageUrl}
          name={agent.name}
          seed={agent.activitySeed ?? agent.id}
          size="sm"
          state={agent.status === "done" ? "complete" : agent.status}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight">
            {agent.name}
          </p>
          <p className="flex items-center gap-1 truncate text-[10px] leading-tight uppercase tracking-wide text-muted-foreground">
            <span className="sr-only">{STATUS_LABEL[agent.status]}, </span>
            {agent.role}
          </p>
        </div>
      </div>
      <p
        className="mt-0.5 truncate pr-7 text-[10px] leading-tight text-muted-foreground/70"
        title={agent.modelId ?? undefined}
      >
        {modelName ?? (agent.threadId ? "Not recorded" : "Not assigned")}
      </p>
    </>
  );
  const surface =
    "block w-full cursor-pointer rounded-xl p-2.5 pb-2 text-left focus-visible:outline focus-visible:outline-2";

  return (
    <article
      className={cn(
        glass(),
        "relative select-none rounded-xl border transition-colors",
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
          "absolute right-1 top-1/2 inline-flex size-8 cursor-pointer -translate-y-1/2 items-center justify-center rounded-lg",
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
          <AudioLines aria-hidden className="size-3.5" />
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
  collapsible?: boolean;
};

/** Horizontal, snap-scrolling row of compact subagent cards for the condensed dashboard. */
export function NextSubagentSwipeRow({
  agents,
  targetedAgentId,
  speakPhaseFor,
  speakDisabled,
  onTarget,
  onSpeakTo,
  onEndSpeak,
  collapsible = false,
}: SubagentSwipeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const working = agents.filter(
    (agent) => agent.status === "working" || agent.status === "blocked"
  ).length;
  const speaking = agents.find((agent) => ["live", "connecting"].includes(speakPhaseFor(agent.id)));

  if (agents.length === 0) return null;

  return (
    <div className="min-w-0">
      {collapsible ? (
        <button
          aria-controls={listId}
          aria-expanded={expanded}
          className="flex min-h-11 w-full select-none items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:bg-background-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          type="button"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="font-medium text-foreground">Agents · {agents.length}</span>
          <span className="min-w-0 flex-1 truncate text-left">
            {speaking ? `Speaking with ${speaking.name}` : `${working} running`}
          </span>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0", expanded && "rotate-180")} />
        </button>
      ) : null}
      <div
        aria-label="Subagents"
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-0.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          collapsible && !expanded && "hidden",
          collapsible && "max-h-[28dvh] overflow-y-auto"
        )}
        id={listId}
        hidden={collapsible && !expanded}
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
    </div>
  );
}
