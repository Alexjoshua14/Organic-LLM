"use client";

import type { ReactNode } from "react";
import type { OrganicToolCallPresenceProps } from "./organic-tool-call-presence";
import type { SessionSignal } from "@/lib/sidebar/session-signal";

import { memo, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { ToolResultInlineRow, ToolResultPinButton } from "./tool-result-inline";
import styles from "./rabbit-hole-tool-presence.module.css";

import { glass } from "@/components/design-system/primitives";
import { SessionGlyph } from "@/components/sidebar/session-glyph";
import { SHOW_TOOL_DETAILS } from "@/lib/chat/tool-details-visibility";
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

const CREATE_TOOLS = new Set([
  "create_rabbit_hole",
  "create_rabbit_hole_node",
  "generate_rabbit_hole_node",
  "branch_rabbit_hole_node",
]);
const BROWSE_TOOLS = new Set(["search_rabbit_holes", "list_rabbit_holes"]);
// These drawer tools historically open a node in place rather than leaving the conversation.
const DRAWER_TOOLS = new Set(["generate_rabbit_hole_node", "navigate_rabbit_hole_node"]);

/** Result rows shown inside the browse disclosure; the full list stays with the model. */
const MAX_RESULTS = 6;

const WORKING: SessionSignal = { kind: "working", step: "sources" };
const IDLE: SessionSignal = { kind: "idle" };

/** Loads one node's key takeaways: `null` if unreadable, `[]` if not written yet. */
export type RabbitHoleKeyPointsLoader = (
  sessionId: string,
  nodeId: string
) => Promise<string[] | null>;

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

export const RabbitHoleToolPresence = memo(function RabbitHoleToolPresence({
  toolName,
  state,
  input,
  output,
  isPinned = false,
  onTogglePin,
  onOpenNode,
  loadKeyPoints,
  showToolDetails = SHOW_TOOL_DETAILS,
  className,
}: OrganicToolCallPresenceProps & {
  onOpenNode: (nodeId: string) => void;
  loadKeyPoints?: RabbitHoleKeyPointsLoader;
  showToolDetails?: boolean;
}) {
  const key = toolName.toLowerCase();
  const args = record(input);
  const result = record(output);
  const pending = state === "in-flight";
  const failed = !pending && (state === "error" || result?.ok === false);
  const settled = !pending && !failed;
  const labels = TOOL_LABELS[key] ?? ["Exploring…", "Rabbit hole response"];
  const creates = CREATE_TOOLS.has(key);
  const browses = BROWSE_TOOLS.has(key);
  const confirmed = result?.ok === true;
  const items = Array.isArray(result?.sessions)
    ? result.sessions
    : Array.isArray(result?.results)
      ? result.results
      : null;
  const results = (items ?? []).flatMap((item) => {
    const entry = record(item);
    const url = sessionHref(entry?.sessionId);
    const label = text(entry?.title);

    return url && label ? [{ url, label, description: text(entry?.description) }] : [];
  });

  let status = pending
    ? labels[0]
    : failed
      ? "Rabbit hole action failed"
      : creates && !confirmed
        ? "Rabbit hole response"
        : labels[1];

  if (settled && browses && items) {
    status = items.length === 0 ? "No rabbit holes found" : `${status} · ${items.length} found`;
  } else if (settled && creates && confirmed && result?.status === "generating") {
    status = `${status} · writing article`;
  }

  const title = text(
    result?.title,
    result?.nodeTitle,
    args?.title,
    args?.label,
    args?.query,
    args?.question
  );
  const href = settled ? sessionHref(result?.sessionId) : null;
  const drawerNode =
    settled && confirmed && DRAWER_TOOLS.has(key)
      ? text(result?.nodeId, result?.activeNodeId)
      : null;
  const keyPointsTarget =
    settled && creates && confirmed && loadKeyPoints
      ? { sessionId: text(result?.sessionId), nodeId: text(result?.nodeId) }
      : null;
  const error = failed ? text(result?.error, typeof output === "string" ? output : null) : null;

  const action = drawerNode ? (
    <button
      aria-label="View article"
      className={cn(styles.action, glass({ chip: true }), "rounded-full organic-focus")}
      data-rabbit-hole-open-node={drawerNode}
      type="button"
      onClick={() => onOpenNode(drawerNode)}
    >
      View
      <ArrowUpRight aria-hidden="true" size={12} />
    </button>
  ) : href && !browses ? (
    <a
      aria-label="Open rabbit hole"
      className={cn(styles.action, glass({ chip: true }), "rounded-full organic-focus")}
      href={href}
    >
      Open
      <ArrowUpRight aria-hidden="true" size={12} />
    </a>
  ) : null;

  const disclosures: ReactNode[] = [];

  if (keyPointsTarget?.sessionId && keyPointsTarget.nodeId && loadKeyPoints) {
    disclosures.push(
      <KeyPoints
        key="key-points"
        load={loadKeyPoints}
        nodeId={keyPointsTarget.nodeId}
        sessionId={keyPointsTarget.sessionId}
      />
    );
  }
  if (settled && browses && results.length > 0) {
    disclosures.push(
      <Disclosure
        key="results"
        label={results.length === 1 ? "1 result" : `${results.length} results`}
      >
        <ul className={styles.results}>
          {results.slice(0, MAX_RESULTS).map(({ url, label, description }, index) => (
            <li key={`${url}-${index}`}>
              <a className={cn(styles.result, "organic-focus")} href={url}>
                <span className={styles.resultText}>
                  <span className={styles.resultTitle}>{label}</span>
                  {description && <span className={styles.resultDescription}>{description}</span>}
                </span>
                <ArrowUpRight aria-hidden="true" size={12} />
              </a>
            </li>
          ))}
        </ul>
        {results.length > MAX_RESULTS && (
          <p className={styles.more}>
            Showing {MAX_RESULTS} of {results.length}
          </p>
        )}
      </Disclosure>
    );
  }
  if (showToolDetails && !pending && output != null) {
    disclosures.push(<ToolDetails key="details" output={output} />);
  }

  const card = (
    <div
      className={cn(
        "not-prose",
        glass(),
        styles.card,
        "rounded-xl",
        failed
          ? cn(styles.failed, "border-destructive/40 bg-destructive/5")
          : pending
            ? cn(styles.pending, "border-accent/35 bg-accent/5")
            : "border-border/40 bg-background-secondary/25",
        className
      )}
      data-organic-tool-presence={toolName}
      data-rabbit-hole-tool=""
      data-tool-state={pending ? "in-flight" : failed ? "error" : "complete"}
    >
      <div className={styles.row}>
        <span className={styles.mark}>
          <SessionGlyph experience="rabbitHole" signal={pending ? WORKING : IDLE} />
        </span>
        <div className={styles.text}>
          {title && (
            <p className={styles.title} title={title}>
              {title}
            </p>
          )}
          <p
            aria-atomic="true"
            className={title ? styles.status : styles.title}
            data-rabbit-hole-status=""
            role="status"
          >
            {status}
          </p>
          {error && <p className={styles.error}>{error}</p>}
        </div>
        {action}
      </div>
      {disclosures.length > 0 && <div className={styles.disclosures}>{disclosures}</div>}
    </div>
  );

  return pending ? (
    card
  ) : (
    <ToolResultInlineRow
      className={styles.inlineRow}
      isPinned={isPinned}
      pin={
        onTogglePin ? <ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} /> : null
      }
    >
      {card}
    </ToolResultInlineRow>
  );
});

/** Native disclosure: secondary information that stays out of the way until asked for. */
function Disclosure({
  label,
  children,
  onOpen,
}: {
  label: string;
  children: ReactNode;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className={styles.disclosure}
      onToggle={(event) => {
        const next = event.currentTarget.open;

        setOpen(next);
        if (next) onOpen?.();
      }}
    >
      <summary className="organic-focus">
        <ChevronRight aria-hidden="true" size={12} />
        {label}
      </summary>
      {open && <div className={styles.panel}>{children}</div>}
    </details>
  );
}

type KeyPointsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; points: string[] }
  | { kind: "unavailable" };

/** Loads on first open (and again while the article is unwritten); never polls. */
function KeyPoints({
  sessionId,
  nodeId,
  load,
}: {
  sessionId: string;
  nodeId: string;
  load: RabbitHoleKeyPointsLoader;
}) {
  const [state, setState] = useState<KeyPointsState>({ kind: "idle" });
  // A ref, not state: two toggles in one tick must not start two reads.
  const settledWithPoints = useRef(false);
  const inFlight = useRef(false);

  const fetchPoints = () => {
    if (inFlight.current || settledWithPoints.current) return;
    inFlight.current = true;
    setState({ kind: "loading" });
    load(sessionId, nodeId)
      .then(
        (points) => {
          settledWithPoints.current = !!points?.length;
          setState(points ? { kind: "ready", points } : { kind: "unavailable" });
        },
        () => setState({ kind: "unavailable" })
      )
      .finally(() => {
        inFlight.current = false;
      });
  };

  return (
    <Disclosure label="Key points" onOpen={fetchPoints}>
      {state.kind === "ready" && state.points.length > 0 ? (
        <ul className={styles.points}>
          {state.points.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      ) : (
        <p aria-live="polite" className={styles.quiet}>
          {state.kind === "unavailable"
            ? "Key points could not be loaded."
            : state.kind === "ready"
              ? "Key points appear once the article is written."
              : "Loading key points…"}
        </p>
      )}
    </Disclosure>
  );
}

function ToolDetails({ output }: { output: unknown }) {
  return (
    <Disclosure label="Tool details">
      <pre className={styles.raw}>{formatOutput(output)}</pre>
    </Disclosure>
  );
}

function formatOutput(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Tool details could not be displayed.";
  }
}
