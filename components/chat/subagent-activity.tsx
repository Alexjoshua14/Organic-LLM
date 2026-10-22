"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { InlineSubagentDispatch } from "@/lib/arcadia/multitask/inline-dispatches";

import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { SubagentIdentityMark } from "@/components/agents/subagent-identity-mark";
import { getModelDisplayName } from "@/lib/chat/message-model";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { idle: "Idle", working: "Working", blocked: "Needs attention", done: "Done" };
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function revealSubagentActivity(id: string) {
  const details = document.getElementById(id);
  if (!(details instanceof window.HTMLDetailsElement)) return;
  details.open = true;
  details.querySelector("summary")?.focus({ preventScroll: true });
  // Instant navigation also respects reduced motion and never resumes automatic following.
  details.scrollIntoView({ block: "nearest", behavior: "instant" });
}

/** A sibling of the scroll viewport: stays visible without covering messages or the composer. */
export function ActiveSubagentStrip({
  agents,
  onReveal,
}: {
  agents: readonly ArcadiaSubagent[];
  onReveal: (agent: ArcadiaSubagent) => void;
}) {
  const active = agents.filter((agent) => agent.status === "working" || agent.status === "blocked");
  if (active.length === 0) return null;

  return (
    <nav
      aria-label="Active subagents"
      className="w-full shrink-0 border-b border-border/40 bg-background/95 px-4 py-2"
    >
      <div className="mx-auto flex max-w-232 items-center gap-inline-sm">
        <span className="shrink-0 text-xs text-muted-foreground">Agents · {active.length}</span>
        <div className="flex min-w-0 flex-1 gap-inline-sm overflow-x-auto py-1">
          {active.map((agent) => (
            <button
              key={agent.id}
              type="button"
              aria-label={`Show ${agent.name}: ${STATUS_LABEL[agent.status]}`}
              onClick={() => onReveal(agent)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-background-secondary/50 px-2.5 text-left hover:bg-background-secondary",
                FOCUS_RING
              )}
            >
              <SubagentIdentityMark
                name={agent.name}
                seed={agent.activitySeed ?? agent.id}
                imageUrl={agent.identityImageUrl}
                state={agent.status === "done" ? "complete" : agent.status}
                size="sm"
                className="size-6"
              />
              <span className="max-w-40 truncate text-xs font-medium">{agent.name}</span>
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  agent.status === "blocked" && "text-amber-800 dark:text-amber-200"
                )}
              >
                {STATUS_LABEL[agent.status]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

/** One durable dispatch, with live progress only when it is still the agent's current goal. */
export function InlineSubagentActivity({
  id,
  dispatch,
  agent,
  threadId = dispatch?.threadId ?? agent?.threadId,
}: {
  id: string;
  dispatch?: InlineSubagentDispatch;
  agent?: ArcadiaSubagent;
  threadId?: string | null;
}) {
  const name = dispatch?.name ?? agent?.name ?? "Subagent";
  const brief = dispatch?.brief ?? agent?.goal;
  const model = getModelDisplayName(dispatch?.modelId ?? agent?.modelId);
  const status = agent ? STATUS_LABEL[agent.status] : "Sent";

  return (
    <details
      id={id}
      className="group/subagent min-w-0 rounded-lg border border-border/50 bg-background-secondary/20 text-sm"
    >
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 [&::-webkit-details-marker]:hidden",
          FOCUS_RING
        )}
      >
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground group-open/subagent:rotate-90"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{name}</span>
            <span
              className={cn(
                "text-xs text-muted-foreground",
                agent?.status === "blocked" && "text-amber-800 dark:text-amber-200"
              )}
            >
              {status}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {agent?.progress || brief}
          </span>
        </span>
      </summary>
      <div className="space-y-stack-md border-t border-border/40 px-3 py-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{brief}</p>
        {agent?.progress && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {agent.progress}
          </p>
        )}
        {!agent && (
          <p className="text-xs text-muted-foreground">
            Assignment sent. Open the agent’s conversation for its progress and result.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {model && <span>LLM · {model}</span>}
          {threadId && (
            <Link
              href={`/sandbox/arcadia/${encodeURIComponent(threadId)}`}
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded px-1 text-foreground underline underline-offset-4",
                FOCUS_RING
              )}
            >
              Open conversation <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </details>
  );
}
