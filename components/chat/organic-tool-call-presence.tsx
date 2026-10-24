"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ToolResultInlineRow, ToolResultPinButton } from "./tool-result-inline";

import { OrganicActivityMark } from "@/components/chat/organic-activity-mark";
import { glass } from "@/components/design-system/primitives";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { extractMermaidCode } from "@/lib/mermaid/source";
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

    return {
      seed: `subagent-${name.toLowerCase()}`,
      category: `Subagent${roleTag}`,
      inFlightTitle: inFlightLabelOverride ?? `Briefing ${name}…`,
      completedTitle: specialist ? `Dispatched to ${name}` : "Dispatched subagent",
      subtitle: brief,
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

  if (
    key === "generate_rabbit_hole_node" ||
    key === "propose_rabbit_hole_node" ||
    key === "create_rabbit_hole_node" ||
    key === "branch_rabbit_hole_node"
  ) {
    const nodeTitle = firstNonEmptyString(
      outputRec?.title,
      outputRec?.nodeTitle,
      inputRec?.label,
      inputRec?.title,
      inputRec?.topic,
      inputRec?.question,
      inputRec?.query
    );

    return {
      seed: "tool-rabbit-hole-branch",
      category: "Rabbit Hole",
      inFlightTitle: inFlightLabelOverride ?? "Branching rabbit hole node…",
      completedTitle: "Branching rabbit hole node",
      subtitle: nodeTitle,
      specialistName: null,
      intensity: 0.74,
    };
  }

  if (key === "navigate_rabbit_hole_node") {
    const targetTitle = firstNonEmptyString(
      outputRec?.title,
      outputRec?.nodeTitle,
      inputRec?.title,
      inputRec?.label,
      outputRec?.activeNodeId,
      inputRec?.nodeId
    );

    return {
      seed: "tool-rabbit-hole-nav",
      category: "Rabbit Hole",
      inFlightTitle: inFlightLabelOverride ?? "Navigating branch…",
      completedTitle: "Navigating branch",
      subtitle: targetTitle,
      specialistName: null,
      intensity: 0.52,
    };
  }

  if (
    key === "search_rabbit_hole_context" ||
    key === "read_rabbit_hole_node" ||
    key === "inspect_rabbit_hole_graph"
  ) {
    const query = firstNonEmptyString(inputRec?.query, inputRec?.nodeId, outputRec?.summary);

    return {
      seed: "tool-rabbit-hole-context",
      category: "Rabbit Hole",
      inFlightTitle: inFlightLabelOverride ?? "Reading rabbit hole graph…",
      completedTitle: "Synthesized rabbit hole context",
      subtitle: query,
      specialistName: null,
      intensity: 0.56,
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
}: OrganicToolCallPresenceProps) {
  const [expanded, setExpanded] = useState(false);
  const identity = resolveOrganicToolVisualIdentity(toolName, input, output, inFlightLabel);
  const isInFlight = state === "in-flight";
  const isError = state === "error";
  const markState = isInFlight ? "working" : isError ? "blocked" : "complete";
  const primaryLabel = isInFlight ? identity.inFlightTitle : identity.completedTitle;

  const hasDetailPayload = !isInFlight && output !== undefined && output !== null;
  const mermaid = hasDetailPayload ? extractMermaidCode(output) : null;
  const formattedOutput = hasDetailPayload ? stableStringify(output) : null;

  const outputRec = asRecord(output);
  const inputRec = asRecord(input);
  const normalizedToolName = toolName.toLowerCase();
  const rabbitHoleTargetNodeId =
    !isInFlight &&
    !isError &&
    (normalizedToolName === "generate_rabbit_hole_node" ||
      normalizedToolName === "navigate_rabbit_hole_node") &&
    outputRec?.ok !== false
      ? firstNonEmptyString(outputRec?.nodeId, outputRec?.activeNodeId, inputRec?.nodeId)
      : null;

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
            : "border-border/40 bg-background-secondary/25 hover:border-border/65 hover:bg-background-secondary/40",
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
          {rabbitHoleTargetNodeId ? (
            <p
              data-rabbit-hole-open-node={rabbitHoleTargetNodeId}
              className="mt-0.5 truncate text-[11px] font-medium text-foreground underline decoration-border/60 underline-offset-2"
            >
              {identity.subtitle ? `View article · ${identity.subtitle}` : "View article"}
            </p>
          ) : identity.subtitle ? (
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
          if (rabbitHoleTargetNodeId) {
            dispatchRabbitHoleOpenNode(rabbitHoleTargetNodeId);
          }

          setExpanded((open) => !open);
        }}
      >
        {pillContent}
      </button>
    </ToolResultInlineRow>
  );
});

OrganicToolCallPresence.displayName = "OrganicToolCallPresence";
