"use client";

import type { OrganicToolCallPresenceProps } from "./organic-tool-call-presence";

import { memo, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, TriangleAlert } from "lucide-react";

import { ToolResultInlineRow, ToolResultPinButton } from "./tool-result-inline";
import styles from "./rabbit-hole-tool-presence.module.css";

import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, readonly [string, string]> = {
  create_rabbit_hole: ["Creating a rabbit hole…", "Rabbit hole created"],
  create_rabbit_hole_node: ["Adding a branch…", "Branch created"],
  generate_rabbit_hole_node: ["Adding a branch…", "Branch created"],
  branch_rabbit_hole_node: ["Adding a branch…", "Branch created"],
  propose_rabbit_hole_node: ["Proposing a branch…", "Branch proposed"],
  navigate_rabbit_hole_node: ["Navigating a branch…", "Branch selected"],
  list_rabbit_holes: ["Browsing rabbit holes…", "Rabbit holes browsed"],
  search_rabbit_holes: ["Searching rabbit holes…", "Rabbit holes searched"],
  get_rabbit_hole: ["Reading a rabbit hole…", "Rabbit hole read"],
  get_rabbit_hole_node: ["Reading an article…", "Article read"],
  get_rabbit_hole_node_section: ["Reading a section…", "Section read"],
  search_rabbit_hole_context: ["Searching the graph…", "Graph searched"],
  read_rabbit_hole_node: ["Reading an article…", "Article read"],
  inspect_rabbit_hole_graph: ["Inspecting the graph…", "Graph inspected"],
};

export function isRabbitHoleToolName(toolName: string): boolean {
  return Object.hasOwn(TOOL_LABELS, toolName.toLowerCase());
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(...values: unknown[]): string | null {
  return (
    values.find((value): value is string => typeof value === "string" && !!value.trim())?.trim() ??
    null
  );
}

// Build the destination ourselves: tool output never supplies an arbitrary link or protocol.
function sessionHref(value: unknown): string | null {
  const id = text(value);

  return id ? `/rabbitholes?sessionId=${encodeURIComponent(id)}` : null;
}

/** Fixed curvilinear mesh: no filters, per-frame JS, random geometry, or shared SVG ids. */
const RabbitHoleTunnel = memo(function RabbitHoleTunnel() {
  return (
    <svg aria-hidden="true" className={styles.tunnel} fill="none" viewBox="0 0 160 160">
      <g className={styles.mesh} stroke="currentColor" strokeWidth="0.65">
        {[68, 53, 40, 29, 20, 13, 8].map((radius) => (
          <rect
            key={radius}
            height={radius * 2}
            rx={radius * 0.74}
            width={radius * 2}
            x={80 - radius}
            y={80 - radius}
          />
        ))}
        <path d="M0 0Q57 23 80 80Q103 137 160 160M160 0Q103 23 80 80Q57 137 0 160M80 0V160M0 80H160M0 40Q51 48 80 80Q109 112 160 120M0 120Q51 112 80 80Q109 48 160 40M40 0Q48 51 80 80Q112 109 120 160M120 0Q112 51 80 80Q48 109 40 160" />
      </g>
      <g className={styles.ripple} stroke="currentColor" strokeWidth="1.2">
        <rect height="80" rx="29.6" width="80" x="40" y="40" />
        <rect height="40" rx="14.8" width="40" x="60" y="60" />
      </g>
      <circle cx="80" cy="80" fill="currentColor" r="2" />
    </svg>
  );
});

export const RabbitHoleToolPresence = memo(function RabbitHoleToolPresence({
  toolName,
  state,
  input,
  output,
  isPinned = false,
  onTogglePin,
  onOpenNode,
  className,
}: OrganicToolCallPresenceProps & { onOpenNode: (nodeId: string) => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const key = toolName.toLowerCase();
  const args = record(input);
  const result = record(output);
  const pending = state === "in-flight";
  const failed = !pending && (state === "error" || result?.ok === false);
  const labels = TOOL_LABELS[key] ?? ["Exploring…", "Rabbit hole response"];
  const creates = [
    "create_rabbit_hole",
    "create_rabbit_hole_node",
    "generate_rabbit_hole_node",
    "branch_rabbit_hole_node",
  ].includes(key);
  const confirmed = result?.ok === true;
  const status = pending
    ? labels[0]
    : failed
      ? "Rabbit hole action failed"
      : creates && !confirmed
        ? "Rabbit hole response"
        : labels[1];
  const title = text(
    result?.title,
    result?.nodeTitle,
    args?.title,
    args?.label,
    args?.query,
    args?.question
  );
  const href = !pending && !failed ? sessionHref(result?.sessionId) : null;
  // These drawer tools historically open a node in place rather than leaving the conversation.
  const drawerNode =
    !pending &&
    !failed &&
    confirmed &&
    ["generate_rabbit_hole_node", "navigate_rabbit_hole_node"].includes(key)
      ? text(result?.nodeId, result?.activeNodeId)
      : null;
  const background =
    !pending && !failed && (result?.status === "generating" || (creates && confirmed));
  const error = failed ? text(result?.error, typeof output === "string" ? output : null) : null;
  const items = Array.isArray(result?.sessions)
    ? result.sessions
    : Array.isArray(result?.results)
      ? result.results
      : [];
  const destinations = items
    .flatMap((item) => {
      const entry = record(item);
      const url = sessionHref(entry?.sessionId);
      const label = text(entry?.title);

      return url && label ? [{ url, label }] : [];
    })
    .slice(0, 4);

  const card = (
    <div
      className={cn("not-prose", styles.card, className)}
      data-organic-tool-presence={toolName}
      data-rabbit-hole-tool=""
      data-tool-state={pending ? "in-flight" : failed ? "error" : "complete"}
    >
      <div className={styles.body}>
        <div className={styles.art}>
          <RabbitHoleTunnel />
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            Rabbit hole <span aria-hidden="true">/</span>{" "}
            {key === "create_rabbit_hole" ? "New exploration" : creates ? "Branch" : "Explore"}
          </p>
          <p aria-atomic="true" className={styles.status} role="status">
            {!pending &&
              (!creates || confirmed || failed) &&
              (failed ? (
                <TriangleAlert aria-hidden="true" size={14} />
              ) : (
                <Check aria-hidden="true" size={14} />
              ))}
            {status}
          </p>
          {title && (
            <p className={styles.title} title={title}>
              {title}
            </p>
          )}
          {background && (
            <p className={styles.note}>
              Article generating in the background. Open to follow its progress.
            </p>
          )}
          {error && <p className={styles.note}>{error}</p>}
          {!pending &&
            !failed &&
            (key === "search_rabbit_holes" || key === "list_rabbit_holes") &&
            (Array.isArray(result?.sessions) || Array.isArray(result?.results)) && (
              <p className={styles.note}>
                {items.length === 0
                  ? "No rabbit holes found."
                  : `${items.length} rabbit hole${items.length === 1 ? "" : "s"} returned.`}
              </p>
            )}
          {drawerNode ? (
            <button
              className={cn(styles.open, "organic-focus")}
              data-rabbit-hole-open-node={drawerNode}
              type="button"
              onClick={() => onOpenNode(drawerNode)}
            >
              View article <ArrowUpRight aria-hidden="true" size={14} />
            </button>
          ) : href ? (
            <a className={cn(styles.open, "organic-focus")} href={href}>
              Open rabbit hole <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          ) : null}
        </div>
      </div>
      {!pending && !failed && destinations.length > 0 && (
        <ul className={styles.destinations}>
          {destinations.map(({ url, label }, index) => (
            <li key={`${url}-${index}`}>
              <a className="organic-focus" href={url}>
                {label}
                <ArrowUpRight aria-hidden="true" size={14} />
              </a>
            </li>
          ))}
        </ul>
      )}
      {!pending && output != null && (
        <details
          className={styles.details}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary className="organic-focus">
            <ChevronRight aria-hidden="true" size={12} />
            Tool details
          </summary>
          {detailsOpen && <pre>{formatOutput(output)}</pre>}
        </details>
      )}
    </div>
  );

  return pending ? (
    card
  ) : (
    <ToolResultInlineRow
      className={styles.row}
      isPinned={isPinned}
      pin={
        onTogglePin ? <ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} /> : null
      }
    >
      {card}
    </ToolResultInlineRow>
  );
});

function formatOutput(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Tool details could not be displayed.";
  }
}
