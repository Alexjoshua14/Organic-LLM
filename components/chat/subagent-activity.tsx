"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { InlineSubagentDispatch } from "@/lib/arcadia/multitask/inline-dispatches";

import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { SubagentIdentityMark } from "@/components/agents/subagent-identity-mark";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { getModelDisplayName } from "@/lib/chat/message-model";
import { markdownToTtsPlainText } from "@/lib/strata/elaborated-tts";
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

/** First meaningful line of a result, as plain text: the row's one-line preview. */
export function subagentPreviewLine(text: string | null | undefined): string {
  const first = text?.split("\n").find((line) => line.replace(/[#>*_\-\s|`]/g, "").length > 0);

  return first ? markdownToTtsPlainText(first) : "";
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
  const result = agent?.progress?.trim() || null;
  const preview = subagentPreviewLine(result) || subagentPreviewLine(brief);
  const markState = !agent ? "idle" : agent.status === "done" ? "complete" : agent.status;

  return (
    <details
      id={id}
      className="group/subagent min-w-0 rounded-xl bg-background-secondary/30 text-sm transition-colors open:bg-background-secondary/45 hover:bg-background-secondary/45"
    >
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-inline-sm rounded-xl px-inset-md py-inset-sm [&::-webkit-details-marker]:hidden",
          FOCUS_RING
        )}
      >
        <SubagentIdentityMark
          name={name}
          seed={agent?.activitySeed ?? agent?.id ?? dispatch?.agentId ?? name}
          imageUrl={agent?.identityImageUrl}
          state={markState}
          size="sm"
          className="size-7 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-inline-sm">
            <span className="shrink-0 font-medium">{name}</span>
            <span
              className={cn(
                "shrink-0 text-xs text-muted-foreground",
                agent?.status === "blocked" && "text-amber-800 dark:text-amber-200"
              )}
            >
              {status}
            </span>
          </span>
          {preview && (
            <span className="block truncate text-xs text-muted-foreground">{preview}</span>
          )}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-open/subagent:rotate-90 motion-reduce:transition-none"
        />
      </summary>
      <div className="space-y-stack-md px-inset-md pb-inset-md">
        {result ? (
          <div className="min-w-0 text-sm leading-relaxed [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
            <ChatMessageMarkdown content={result} id={`${id}-result`} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {agent?.status === "working"
              ? "Working on it. The result appears here when it's done."
              : "Assignment sent. Open the conversation for progress."}
          </p>
        )}
        {brief && (
          <details className="group/brief text-xs text-muted-foreground">
            <summary
              className={cn(
                "inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded [&::-webkit-details-marker]:hidden",
                FOCUS_RING
              )}
            >
              <ChevronRight
                aria-hidden
                className="size-3 group-open/brief:rotate-90 motion-reduce:transition-none"
              />
              Assignment
            </summary>
            <p className="whitespace-pre-wrap break-words leading-relaxed">{brief}</p>
          </details>
        )}
        <div className="flex flex-wrap items-center justify-between gap-inline-sm text-xs text-muted-foreground">
          {model && <span>LLM · {model}</span>}
          {threadId && (
            <Link
              href={`/sandbox/arcadia/${encodeURIComponent(threadId)}`}
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded px-1 text-foreground underline-offset-4 hover:underline",
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
