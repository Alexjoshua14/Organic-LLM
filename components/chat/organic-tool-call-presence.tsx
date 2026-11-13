"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ToolResultInlineRow, ToolResultPinButton } from "./tool-result-inline";
import { RabbitHoleToolPresence, isRabbitHoleToolName } from "./rabbit-hole-tool-presence";

import { OrganicActivityMark } from "@/components/chat/organic-activity-mark";
import { glass } from "@/components/design-system/primitives";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { SHOW_TOOL_DETAILS } from "@/lib/chat/tool-details-visibility";
import { extractMermaidCode } from "@/lib/mermaid/source";
import { loadRabbitHoleKeyPoints } from "@/lib/rabbit-holes/load-key-points";
import { cn } from "@/lib/utils";

export const RABBIT_HOLE_OPEN_NODE_EVENT = "rabbit-hole:open-node";

export function dispatchRabbitHoleOpenNode(nodeId: string): void {
  if (typeof window === "undefined" || !nodeId) return;

  window.dispatchEvent(
    new CustomEvent<{ nodeId: string }>(RABBIT_HOLE_OPEN_NODE_EVENT, {
      detail: { nodeId },
    })
  );
}

export type OrganicToolCallPresenceProps = {
  toolName: string;
  state: "in-flight" | "complete" | "error";
  /** Human-readable in-flight label (e.g. from KNOWN_TOOL_IN_FLIGHT_LABELS). */
  inFlightLabel?: string;
  input?: unknown;
  output?: unknown;
  isPinned?: boolean;
  onTogglePin?: () => void;
  className?: string;
  /** Raw output disclosure; defaults to dev instances only (see SHOW_TOOL_DETAILS). */
  showToolDetails?: boolean;
};

type ToolVisualIdentity = {
  seed: string;
  category: string;
  inFlightTitle: string;
  completedTitle: string;
  subtitle: string | null;
  specialistName: string | null;
  intensity: number;
};

const HARD_SET_SPECIALIST_BY_ID: Record<string, { name: string; role: string }> = {
  "subagent-researcher": { name: "Lyra", role: "researcher" },
  researcher: { name: "Lyra", role: "researcher" },
  lyra: { name: "Lyra", role: "researcher" },
  "agent-coder": { name: "Reed", role: "coder" },
  "subagent-coder": { name: "Reed", role: "coder" },
  coder: { name: "Reed", role: "coder" },
  reed: { name: "Reed", role: "coder" },
  "subagent-architect": { name: "Archer", role: "architect" },
  architect: { name: "Archer", role: "architect" },
  archer: { name: "Archer", role: "architect" },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNonEmptyString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();

      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function humanizeToolSlug(toolName: string): string {
  const cleaned = toolName.replace(/[_-]+/g, " ").trim();

  if (!cleaned) return "Agent action";

  return `${cleaned[0]!.toUpperCase()}${cleaned.slice(1)}`;
}

function resolveSpecialist(
  inputRec: Record<string, unknown> | null,
  outputRec: Record<string, unknown> | null
): { name: string; role: string | null } | null {
  const rawAgent = firstNonEmptyString(
    outputRec?.name,
    inputRec?.name,
    outputRec?.agentName,
    inputRec?.agentName,
    outputRec?.agentId,
    inputRec?.agentId,
    inputRec?.target,
    inputRec?.agent
  );

  if (!rawAgent) return null;

  const lookup = HARD_SET_SPECIALIST_BY_ID[rawAgent.toLowerCase()];

  if (lookup) {
    return lookup;
  }

  const explicitRole = firstNonEmptyString(outputRec?.role, inputRec?.role);

  return {
    name: humanizeToolSlug(rawAgent.replace(/^(subagent|agent)[-_]/i, "")),
    role: explicitRole,
  };
}

export function resolveOrganicToolVisualIdentity(
  toolName: string,
  input?: unknown,
  output?: unknown,
  inFlightLabelOverride?: string
): ToolVisualIdentity {
  const key = toolName.toLowerCase();
  const inputRec = asRecord(input);
  const outputRec = asRecord(output);

  const githubTitles: Record<string, { inFlight: string; completed: string }> = {
    github_repo_overview: { inFlight: "Reading repository…", completed: "Repository overview" },
    github_recent_commits: { inFlight: "Reading commits…", completed: "Recent commits" },
    github_pull_requests: { inFlight: "Reading pull requests…", completed: "Pull requests" },
    github_read_file: { inFlight: "Reading file…", completed: "Repository file" },
  };
  const githubTitle = githubTitles[key];

  if (githubTitle) {
    return {
      seed: `tool-${key}`,
      category: "GitHub",
      inFlightTitle: inFlightLabelOverride ?? githubTitle.inFlight,
      completedTitle: githubTitle.completed,
      subtitle: null,
      specialistName: null,
      intensity: 0.58,
    };
  }

  if (key === "dispatch_subagent" || key === "delegate_subagent") {
    const specialist = resolveSpecialist(inputRec, outputRec);
    const brief = firstNonEmptyString(
      inputRec?.brief,
      inputRec?.goal,
      inputRec?.task,
      inputRec?.prompt,
      outputRec?.brief,
      outputRec?.goal,
      outputRec?.summary
    );
    const name = specialist?.name ?? "Subagent";
    const roleTag = specialist?.role ? ` (${specialist.role})` : "";
    // Accepted dispatches render as assignment rows; a card that reaches here was refused or
    // only sized, so never title it "Dispatched".
    const refused = outputRec?.success === false || outputRec?.ok === false;
    const dryRun = outputRec?.dryRun === true;
    const completedTitle = refused
      ? `Couldn't dispatch to ${specialist ? name : "a subagent"}`
      : dryRun
        ? `Sized a brief for ${name}`
        : specialist
          ? `Dispatched to ${name}`
          : "Dispatched subagent";

    return {
      seed: `subagent-${name.toLowerCase()}`,
      category: `Subagent${roleTag}`,
      inFlightTitle: inFlightLabelOverride ?? `Briefing ${name}…`,
      completedTitle,
      subtitle: refused ? (firstNonEmptyString(outputRec?.error) ?? brief) : brief,
      specialistName: name,
      intensity: 0.78,
    };
  }

  if (key === "read_subagent_thread") {
    const specialist = resolveSpecialist(inputRec, outputRec);
    const name = specialist?.name;

    return {
      seed: name ? `subagent-${name.toLowerCase()}` : "tool-read-subagent-thread",
      category: "Subagent Thread",
      inFlightTitle: inFlightLabelOverride ?? "Reading a subagent's thread...",
      completedTitle: name ? `Read ${name}'s thread` : "Checked subagent thread",
      subtitle: firstNonEmptyString(outputRec?.summary, outputRec?.status, inputRec?.threadId),
      specialistName: name ?? null,
      intensity: 0.58,
    };
  }

  if (key === "worktable") {
    const rawOp = firstNonEmptyString(
      inputRec?.op,
      inputRec?.action,
      inputRec?.command,
      inputRec?.cmd,
      outputRec?.op,
      typeof input === "string" ? input : null
    );
    const isManpage = rawOp ? /\b(man|help|doc)\b/i.test(rawOp) : false;

    return {
      seed: "tool-worktable",
      category: "Workbench",
      inFlightTitle:
        inFlightLabelOverride ??
        (isManpage ? "Reading workbench manpage…" : "Updating the worktable..."),
      completedTitle: isManpage ? "Read workbench manpage" : "Crafting context bundle",
      subtitle: firstNonEmptyString(outputRec?.summary, outputRec?.message, rawOp),
      specialistName: null,
      intensity: 0.62,
    };
  }

  if (key === "web_search") {
    const query = firstNonEmptyString(inputRec?.query, inputRec?.q);

    return {
      seed: "tool-web-search",
      category: "Web Search",
      inFlightTitle: inFlightLabelOverride ?? "Searching the web...",
      completedTitle: "Search Results",
      subtitle: query,
      specialistName: null,
      intensity: 0.68,
    };
  }

  if (key === "search_memories" || key === "memory_search") {
    const query = firstNonEmptyString(inputRec?.query, inputRec?.q);

    return {
      seed: "tool-memory-search",
      category: "Memory",
      inFlightTitle: inFlightLabelOverride ?? "Searching memories...",
      completedTitle: "Memory search",
      subtitle: query,
      specialistName: null,
      intensity: 0.55,
    };
  }

  if (key === "gather_restaurant") {
    const restaurantName = firstNonEmptyString(inputRec?.name, inputRec?.query);

    return {
      seed: "tool-gather-restaurant",
      category: "Places",
      inFlightTitle: inFlightLabelOverride ?? "Looking up restaurant…",
      completedTitle: "Looked up restaurant",
      subtitle: restaurantName,
      specialistName: null,
      intensity: 0.6,
    };
  }

  if (key === "make_mermaid_diagram") {
    const diagramTitle = firstNonEmptyString(inputRec?.title, inputRec?.caption);

    return {
      seed: "tool-mermaid-diagram",
      category: "Diagram",
      inFlightTitle: inFlightLabelOverride ?? "Creating diagram...",
      completedTitle: "Mermaid diagram",
      subtitle: diagramTitle,
      specialistName: null,
      intensity: 0.65,
    };
  }

  if (key === "get_full_chat_history") {
    return {
      seed: "tool-chat-history-full",
      category: "History",
      inFlightTitle: inFlightLabelOverride ?? "Getting full chat history...",
      completedTitle: "Fetched full chat history",
      subtitle: null,
      specialistName: null,
      intensity: 0.48,
    };
  }

  if (key === "get_more_chat_history" || key === "get_messages_from_date") {
    return {
      seed: "tool-chat-history-more",
      category: "History",
      inFlightTitle:
        inFlightLabelOverride ??
        (key === "get_messages_from_date"
          ? "Getting chat history for that date..."
          : "Getting more chat history..."),
      completedTitle: "Loaded earlier conversation",
      subtitle: firstNonEmptyString(inputRec?.date),
      specialistName: null,
      intensity: 0.48,
    };
  }

  const humanized = humanizeToolSlug(toolName);

  return {
    seed: `tool-${key}`,
    category: "Organic Agent",
    inFlightTitle: inFlightLabelOverride ?? `${humanized}...`,
    completedTitle: humanized,
    subtitle: firstNonEmptyString(
      inputRec?.query,
      inputRec?.title,
      inputRec?.brief,
      outputRec?.summary,
      outputRec?.message
    ),
    specialistName: null,
    intensity: 0.58,
  };
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const OrganicToolCallPresence = memo(function OrganicToolCallPresence({
  toolName,
  state,
  inFlightLabel,
  input,
  output,
  isPinned = false,
  onTogglePin,
  className,
  showToolDetails = SHOW_TOOL_DETAILS,
}: OrganicToolCallPresenceProps) {
  const [expanded, setExpanded] = useState(false);

  if (isRabbitHoleToolName(toolName)) {
    return (
      <RabbitHoleToolPresence
        className={className}
        input={input}
        isPinned={isPinned}
        loadKeyPoints={loadRabbitHoleKeyPoints}
        output={output}
        showToolDetails={showToolDetails}
        state={state}
        toolName={toolName}
        onOpenNode={dispatchRabbitHoleOpenNode}
        onTogglePin={onTogglePin}
      />
    );
  }

  const identity = resolveOrganicToolVisualIdentity(toolName, input, output, inFlightLabel);
  const isInFlight = state === "in-flight";
  const isError = state === "error";
  const markState = isInFlight ? "working" : isError ? "blocked" : "complete";
  const primaryLabel = isInFlight ? identity.inFlightTitle : identity.completedTitle;

  const hasOutput = !isInFlight && output !== undefined && output !== null;
  // A diagram is content and always expands; the raw payload is a dev-only debugging aid.
  const mermaid = hasOutput ? extractMermaidCode(output) : null;
  const formattedOutput = hasOutput && showToolDetails && expanded ? stableStringify(output) : null;
  const hasDetailPayload = Boolean(mermaid) || (hasOutput && showToolDetails);

  const pillContent = (
    <div
      data-organic-tool-presence={toolName}
      data-tool-state={state}
      className={cn(
        "not-prose group/tool-presence inline-flex max-w-full flex-col rounded-xl border transition-colors",
        glass(),
        isError
          ? "border-destructive/40 bg-destructive/5"
          : isInFlight
            ? "border-accent/35 bg-accent/5"
            : cn(
                "border-border/40 bg-background-secondary/25",
                hasDetailPayload && "hover:border-border/65 hover:bg-background-secondary/40"
              ),
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 px-2.5 py-1.5">
        <OrganicActivityMark
          className="size-6 shrink-0 rounded-md"
          intensity={isInFlight ? identity.intensity : Math.max(0.32, identity.intensity * 0.65)}
          label={`${identity.category}: ${primaryLabel}`}
          seed={identity.seed}
          size="sm"
          state={markState}
        />

        <div className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">{primaryLabel}</span>
            <span className="rounded-full border border-border/45 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {identity.category}
            </span>
          </div>
          {identity.subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{identity.subtitle}</p>
          ) : null}
        </div>

        {hasDetailPayload ? (
          <span
            aria-hidden
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors group-hover/tool-presence:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
        ) : null}
      </div>

      {expanded && hasDetailPayload ? (
        <div className="border-t border-border/35 bg-background/55 px-3 py-2 text-left text-2xs">
          {mermaid ? (
            <div className="mb-2">
              <MermaidDiagram code={mermaid} expandOnDoubleClick />
            </div>
          ) : null}
          {formattedOutput ? (
            <pre className="max-h-60 overflow-auto rounded-md bg-background/70 p-2 font-mono text-2xs leading-snug text-foreground/90">
              {formattedOutput}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (isInFlight) {
    return pillContent;
  }

  if (!hasDetailPayload) {
    return (
      <ToolResultInlineRow
        isPinned={isPinned}
        pin={
          onTogglePin ? <ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} /> : null
        }
      >
        {pillContent}
      </ToolResultInlineRow>
    );
  }

  return (
    <ToolResultInlineRow
      isPinned={isPinned}
      pin={
        onTogglePin ? <ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} /> : null
      }
    >
      <button
        aria-expanded={expanded}
        className="not-prose max-w-full cursor-pointer text-left"
        type="button"
        onClick={() => {
          setExpanded((open) => !open);
        }}
      >
        {pillContent}
      </button>
    </ToolResultInlineRow>
  );
});

OrganicToolCallPresence.displayName = "OrganicToolCallPresence";
