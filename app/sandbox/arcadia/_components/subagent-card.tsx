"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { Mic, Radio } from "lucide-react";

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
  speaking: boolean;
  onSelect: () => void;
  onSpeakTo: () => void;
  speakDisabled?: boolean;
};

/**
 * Condensed main character for one active subagent — not a status chip, not a full page.
 */
export function SubagentCard({
  agent,
  selected,
  speaking,
  onSelect,
  onSpeakTo,
  speakDisabled,
}: SubagentCardProps) {
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
      <div className="mt-3 flex gap-2">
        <button
          className={cn(
            "flex-1 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-xs font-medium",
            "hover:bg-background-secondary transition-colors",
            selected && "border-amber-800/30"
          )}
          type="button"
          onClick={onSelect}
        >
          Open thread
        </button>
        <button
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
            "bg-foreground text-background hover:opacity-90 transition-opacity",
            "disabled:opacity-40 disabled:pointer-events-none"
          )}
          disabled={speakDisabled}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSpeakTo();
          }}
        >
          <Mic aria-hidden className="size-3.5" />
          Speak to
        </button>
      </div>
    </article>
  );
}
