"use client";

import type { CSSProperties, ReactNode } from "react";
import type { OrganicToolCallPresenceProps } from "./organic-tool-call-presence";
import type { SessionSignal } from "@/lib/sidebar/session-signal";

import { memo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { ToolResultInlineRow, ToolResultPinButton } from "./tool-result-inline";
import styles from "./rabbit-hole-tool-presence.module.css";

import { SessionGlyph } from "@/components/sidebar/session-glyph";
import { SHOW_TOOL_DETAILS } from "@/lib/chat/tool-details-visibility";
import { cn } from "@/lib/utils";

/**
 * Rabbit-hole tool results drawn as what they are: explorations made of article nodes.
 * Each tool renders its payload in its own shape (a session tree, an article's key points
 * or outline, ranked explorations with the articles that matched) in the rabbit-hole app's
 * type and path-rail grammar — never the generic tool pill that web search uses.
 * See docs/design/rabbit-hole-tool-presence.md.
 */

const PENDING_LABELS: Record<string, string> = {
  create_rabbit_hole: "Starting a rabbit hole…",
  create_rabbit_hole_node: "Adding a branch…",
  generate_rabbit_hole_node: "Adding a branch…",
  branch_rabbit_hole_node: "Adding a branch…",
  propose_rabbit_hole_node: "Proposing a branch…",
  navigate_rabbit_hole_node: "Moving to a branch…",
  list_rabbit_holes: "Opening your rabbit holes…",
  search_rabbit_holes: "Searching your rabbit holes…",
  get_rabbit_hole: "Reading a rabbit hole…",
  get_rabbit_hole_node: "Reading an article…",
  get_rabbit_hole_node_section: "Reading a section…",
  search_rabbit_hole_context: "Searching this rabbit hole…",
  read_rabbit_hole_node: "Reading an article…",
  inspect_rabbit_hole_graph: "Looking over the graph…",
};

const DRAWER_DONE: Record<string, string> = {
  navigate_rabbit_hole_node: "Moved to this branch",
  propose_rabbit_hole_node: "Branch proposed",
  search_rabbit_hole_context: "Searched this rabbit hole",
  read_rabbit_hole_node: "Article read",
  inspect_rabbit_hole_graph: "Graph inspected",
};

const CREATE_TOOLS = new Set([
  "create_rabbit_hole",
  "create_rabbit_hole_node",
  "generate_rabbit_hole_node",
  "branch_rabbit_hole_node",
]);
// These drawer tools historically open a node in place rather than leaving the conversation.
const DRAWER_TOOLS = new Set(["generate_rabbit_hole_node", "navigate_rabbit_hole_node"]);

/** Explorations shown at a glance in search and list; the rest fold. */
const GLANCE_SESSIONS = 3;
/** Matched articles drawn under one search hit. */
const GLANCE_MATCHES = 3;
/** Rows of a session tree or outline shown before folding. */
const GLANCE_ROWS = 7;
/** Key takeaways shown at a glance when a read returned them. */
const GLANCE_TAKEAWAYS = 3;

const WORKING: SessionSignal = { kind: "working", step: "sources" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Loads one node's key takeaways: `null` if unreadable, `[]` if not written yet. */
export type RabbitHoleKeyPointsLoader = (
  sessionId: string,
  nodeId: string
) => Promise<string[] | null>;

export function isRabbitHoleToolName(toolName: string): boolean {
  return Object.hasOwn(PENDING_LABELS, toolName.toLowerCase());
}

// ─── Payload reading ─────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;

function record(value: unknown): Rec | null {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function records(value: unknown): Rec[] {
  return Array.isArray(value)
    ? value.flatMap((item): Rec[] => {
        const entry = record(item);

        return entry ? [entry] : [];
      })
    : [];
}

function text(...values: unknown[]): string | null {
  return (
    values.find((value): value is string => typeof value === "string" && !!value.trim())?.trim() ??
    null
  );
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && !!item.trim())
    : [];
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

// Build the destination ourselves: tool output never supplies an arbitrary link or protocol.
function sessionHref(value: unknown): string | null {
  const id = text(value);

  return id ? `/rabbitholes?sessionId=${encodeURIComponent(id)}` : null;
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

/** UTC so a server render and the client agree. */
function shortDate(value: unknown): string | null {
  const iso = text(value);
  const time = iso ? Date.parse(iso) : Number.NaN;

  if (Number.isNaN(time)) return null;
  const date = new Date(time);

  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function joinMeta(...parts: Array<string | null | false | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

// ─── Shared pieces ───────────────────────────────────────────────────────────

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Marks the query terms that matched, so a hit shows why it was returned. */
function Highlighted({ value, terms }: { value: string; terms: string[] }) {
  const usable = terms.filter((term) => term.length > 1).slice(0, 12);

  if (usable.length === 0) return <>{value}</>;
  const pattern = new RegExp(`(${usable.map(escapeRegExp).join("|")})`, "gi");
  const lowered = new Set(usable.map((term) => term.toLowerCase()));

  return (
    <>
      {value.split(pattern).map((part, index) =>
        lowered.has(part.toLowerCase()) ? (
          <mark key={index} className={styles.match}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

type TreeRow = {
  id: string;
  title: ReactNode;
  depth: number;
  /** root: an exploration's first article; new: just added; generating: being written; context: a parent shown for placement. */
  tone?: "root" | "new" | "generating" | "context";
  meta?: string | null;
};

/** The path-rail grammar: a stem, a dot per article, indentation for depth. */
function NodeTree({ rows, label }: { rows: TreeRow[]; label: string }) {
  return (
    <ul aria-label={label} className={styles.tree}>
      {rows.map((row) => (
        <li
          key={row.id}
          className={styles.node}
          data-tone={row.tone}
          style={{ "--depth": Math.min(row.depth, 4) } as CSSProperties}
        >
          {row.depth > 0 && <span aria-hidden="true" className={styles.elbow} />}
          <span className={styles.nodeTitle}>{row.title}</span>
          {row.meta && <span className={styles.nodeMeta}>{row.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Orders a parent-linked node list depth-first so the tree reads top to bottom. */
function treeRows(
  nodes: Rec[],
  { generatingNodeId, rootNodeId }: { generatingNodeId: string | null; rootNodeId: string | null }
): TreeRow[] {
  const entries = nodes.flatMap((node) => {
    const id = text(node.nodeId);

    return id
      ? [{ id, title: text(node.title) ?? "Untitled", parent: text(node.parentNodeId) }]
      : [];
  });
  const ids = new Set(entries.map((entry) => entry.id));
  const children = new Map<string | null, typeof entries>();

  for (const entry of entries) {
    const parent = entry.parent && ids.has(entry.parent) ? entry.parent : null;

    children.set(parent, [...(children.get(parent) ?? []), entry]);
  }

  const rows: TreeRow[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    for (const entry of children.get(parent) ?? []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const generating = entry.id === generatingNodeId;

      rows.push({
        id: entry.id,
        title: entry.title,
        depth,
        tone: generating
          ? "generating"
          : entry.id === rootNodeId || depth === 0
            ? "root"
            : undefined,
        meta: generating ? "writing" : null,
      });
      visit(entry.id, depth + 1);
    }
  };

  visit(null, 0);

  return rows;
}

/** Native disclosure: secondary information that stays folded until asked for. */
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
  // Refs, not state: two toggles in one tick must not start two reads.
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
        <Takeaways points={state.points} />
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

function Takeaways({ points }: { points: string[] }) {
  return (
    <ul className={styles.takeaways}>
      {points.map((point, index) => (
        <li key={index}>{point}</li>
      ))}
    </ul>
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

/** An exploration's title in Commissioner, the rabbit-hole app's voice; a link when it has one. */
function ExplorationTitle({
  children,
  href,
  size = "lg",
  label,
}: {
  children: ReactNode;
  href: string | null;
  size?: "lg" | "md";
  label?: string;
}) {
  const className = cn(styles.title, size === "md" && styles.titleMd);

  return href ? (
    <a aria-label={label} className={cn(className, styles.titleLink, "organic-focus")} href={href}>
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <p aria-atomic="true" className={styles.meta} data-rabbit-hole-status="" role="status">
      {children}
    </p>
  );
}

function ViewArticle({ nodeId, onOpen }: { nodeId: string; onOpen: (nodeId: string) => void }) {
  return (
    <button
      className={cn(styles.textAction, "organic-focus")}
      data-rabbit-hole-open-node={nodeId}
      type="button"
      onClick={() => onOpen(nodeId)}
    >
      View article
    </button>
  );
}

// ─── Views, one per payload shape ────────────────────────────────────────────

function subjectOf(args: Rec | null): string | null {
  return text(args?.title, args?.label, args?.query, args?.question);
}

function PendingView({ toolKey, args }: { toolKey: string; args: Rec | null }) {
  const subject = subjectOf(args);

  return (
    <>
      {subject && <ExplorationTitle href={null}>{subject}</ExplorationTitle>}
      <Meta>
        <SessionGlyph className={styles.glyph} experience="rabbitHole" signal={WORKING} />
        {PENDING_LABELS[toolKey] ?? "Exploring…"}
      </Meta>
    </>
  );
}

function ErrorView({
  args,
  result,
  output,
}: {
  args: Rec | null;
  result: Rec | null;
  output: unknown;
}) {
  const subject = subjectOf(args);
  const error = text(result?.error, typeof output === "string" ? output : null);

  return (
    <>
      {subject && <ExplorationTitle href={null}>{subject}</ExplorationTitle>}
      <Meta>Rabbit hole action failed</Meta>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}

function CreateView({
  toolKey,
  args,
  result,
  loadKeyPoints,
  onOpenNode,
}: {
  toolKey: string;
  args: Rec | null;
  result: Rec;
  loadKeyPoints?: RabbitHoleKeyPointsLoader;
  onOpenNode: (nodeId: string) => void;
}) {
  const root = toolKey === "create_rabbit_hole";
  const title = text(result.title, args?.title, args?.label, args?.query) ?? "Untitled";
  const question = text(args?.query, args?.question);
  const sessionId = text(result.sessionId);
  const nodeId = text(result.nodeId);
  const parentTitle = text(result.parentTitle);
  const sessionName = text(result.sessionTitle);
  const href = sessionHref(sessionId);
  const writing = result.status === "generating";
  const drawerNode = DRAWER_TOOLS.has(toolKey) ? text(result.nodeId, result.activeNodeId) : null;

  return (
    <>
      {root ? (
        <>
          <ExplorationTitle href={href} label={`Open rabbit hole: ${title}`}>
            {title}
          </ExplorationTitle>
          <NodeTree
            label="The new rabbit hole"
            rows={[
              {
                id: "root",
                title: question && question !== title ? question : "First article",
                depth: 0,
                tone: writing ? "generating" : "new",
                meta: writing ? "writing" : "new",
              },
            ]}
          />
        </>
      ) : (
        <>
          {sessionName && (
            <ExplorationTitle href={href} label={`Open rabbit hole: ${sessionName}`} size="md">
              {sessionName}
            </ExplorationTitle>
          )}
          <NodeTree
            label="Where the branch attaches"
            rows={[
              ...(parentTitle
                ? [{ id: "parent", title: parentTitle, depth: 0, tone: "context" as const }]
                : []),
              {
                id: "new",
                title,
                depth: parentTitle ? 1 : 0,
                tone: writing ? ("generating" as const) : ("new" as const),
                meta: "new",
              },
            ]}
          />
        </>
      )}
      <Meta>
        {joinMeta(
          root ? "Rabbit hole created" : "Branch created",
          writing && "writing the article"
        )}
      </Meta>
      {drawerNode ? (
        <ViewArticle nodeId={drawerNode} onOpen={onOpenNode} />
      ) : (
        !root &&
        !sessionName &&
        href && (
          <a className={cn(styles.textAction, "organic-focus")} href={href}>
            Open rabbit hole
          </a>
        )
      )}
      {sessionId && nodeId && loadKeyPoints && (
        <KeyPoints load={loadKeyPoints} nodeId={nodeId} sessionId={sessionId} />
      )}
    </>
  );
}

function SessionEntry({ hit, terms }: { hit: Rec; terms: string[] }) {
  const title = text(hit.title) ?? "Untitled";
  const description = text(hit.description);
  const nodeCount = count(hit.nodeCount);
  const matches = records(hit.matchingNodes).slice(0, GLANCE_MATCHES);

  return (
    <li className={styles.entry}>
      <ExplorationTitle
        href={sessionHref(hit.sessionId)}
        label={`Open rabbit hole: ${title}`}
        size="md"
      >
        <Highlighted terms={terms} value={title} />
      </ExplorationTitle>
      {description && description !== title && (
        <p className={styles.description}>
          <Highlighted terms={terms} value={description} />
        </p>
      )}
      {matches.length > 0 && (
        <NodeTree
          label={`Matching articles in ${title}`}
          rows={matches.map((node, index) => ({
            id: text(node.nodeId) ?? String(index),
            title: <Highlighted terms={terms} value={text(node.title) ?? "Untitled"} />,
            depth: 0,
          }))}
        />
      )}
      <p className={styles.entryMeta}>
        {joinMeta(nodeCount !== null && plural(nodeCount, "article"), shortDate(hit.updatedAt))}
      </p>
    </li>
  );
}

function CompactEntry({ hit }: { hit: Rec }) {
  const title = text(hit.title) ?? "Untitled";
  const href = sessionHref(hit.sessionId);
  const nodeCount = count(hit.nodeCount);

  return (
    <li className={styles.compactEntry}>
      {href ? (
        <a className={cn(styles.compactLink, "organic-focus")} href={href}>
          {title}
        </a>
      ) : (
        <span className={styles.compactLink}>{title}</span>
      )}
      <span className={styles.compactMeta}>
        {joinMeta(nodeCount !== null && plural(nodeCount, "article"), shortDate(hit.updatedAt))}
      </span>
    </li>
  );
}

function ExplorationsView({
  heading,
  hits,
  total,
  terms,
  emptyText,
}: {
  heading: ReactNode;
  hits: Rec[];
  total: number;
  terms: string[];
  emptyText: string;
}) {
  const linked = hits.filter((hit) => sessionHref(hit.sessionId));
  const glance = linked.slice(0, GLANCE_SESSIONS);
  const rest = linked.slice(GLANCE_SESSIONS);

  return (
    <>
      <div className={styles.headingRow}>
        <span className={cn(styles.title, styles.titleMd)}>{heading}</span>
        <Meta>{total === 0 ? "None found" : plural(total, "rabbit hole")}</Meta>
      </div>
      {total === 0 ? (
        <p className={styles.quiet}>{emptyText}</p>
      ) : (
        <ol className={styles.entries}>
          {glance.map((hit, index) => (
            <SessionEntry key={`${text(hit.sessionId)}-${index}`} hit={hit} terms={terms} />
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <Disclosure label={`${rest.length} more`}>
          <ol className={styles.compactList}>
            {rest.map((hit, index) => (
              <CompactEntry key={`${text(hit.sessionId)}-${index}`} hit={hit} />
            ))}
          </ol>
        </Disclosure>
      )}
    </>
  );
}

function SessionView({ result }: { result: Rec }) {
  const title = text(result.title) ?? "Untitled";
  const rows = treeRows(records(result.nodes), {
    generatingNodeId: text(result.generatingNodeId),
    rootNodeId: text(result.rootNodeId),
  });
  const nodeCount = count(result.nodeCount) ?? rows.length;
  const description = text(result.description);
  const updated = shortDate(result.updatedAt);

  return (
    <>
      <ExplorationTitle href={sessionHref(result.sessionId)} label={`Open rabbit hole: ${title}`}>
        {title}
      </ExplorationTitle>
      {description && description !== title && <p className={styles.description}>{description}</p>}
      {rows.length > 0 && (
        <NodeTree label={`Articles in ${title}`} rows={rows.slice(0, GLANCE_ROWS)} />
      )}
      <Meta>{joinMeta(plural(nodeCount, "article"), updated && `updated ${updated}`)}</Meta>
      {rows.length > GLANCE_ROWS && (
        <Disclosure label={`${rows.length - GLANCE_ROWS} more articles`}>
          <NodeTree label={`More articles in ${title}`} rows={rows.slice(GLANCE_ROWS)} />
        </Disclosure>
      )}
    </>
  );
}

function ArticleView({ result }: { result: Rec }) {
  const title = text(result.title) ?? "Untitled";
  const question = text(result.userQuestion);
  const takeaways = strings(result.keyTakeaways);
  const branches = Array.isArray(result.childNodeIds) ? result.childNodeIds.length : 0;
  const outline: TreeRow[] = records(result.sections).map((section, index) => ({
    id: text(section.id) ?? String(index),
    title: text(section.heading) ?? `Section ${index + 1}`,
    depth: 0,
  }));

  return (
    <>
      <ExplorationTitle href={sessionHref(result.sessionId)} label={`Open rabbit hole: ${title}`}>
        {title}
      </ExplorationTitle>
      {question && question !== title && <p className={styles.question}>{question}</p>}
      {takeaways.length > 0 ? (
        <Takeaways points={takeaways.slice(0, GLANCE_TAKEAWAYS)} />
      ) : (
        outline.length > 0 && (
          <NodeTree label={`Outline of ${title}`} rows={outline.slice(0, GLANCE_ROWS)} />
        )
      )}
      <Meta>
        {joinMeta(
          "Article read",
          outline.length > 0 && plural(outline.length, "section"),
          branches > 0 && plural(branches, "branch", "branches"),
          result.status === "generating" && "still writing"
        )}
      </Meta>
      {takeaways.length > GLANCE_TAKEAWAYS && (
        <Disclosure label={`${takeaways.length - GLANCE_TAKEAWAYS} more key points`}>
          <Takeaways points={takeaways.slice(GLANCE_TAKEAWAYS)} />
        </Disclosure>
      )}
      {takeaways.length > 0 && outline.length > 0 && (
        <Disclosure label="Outline">
          <NodeTree label={`Outline of ${title}`} rows={outline} />
        </Disclosure>
      )}
      {takeaways.length === 0 && outline.length > GLANCE_ROWS && (
        <Disclosure label={`${outline.length - GLANCE_ROWS} more sections`}>
          <NodeTree label={`More of ${title}`} rows={outline.slice(GLANCE_ROWS)} />
        </Disclosure>
      )}
    </>
  );
}

function SectionView({ result }: { result: Rec }) {
  const section = record(result.section);
  const heading = text(section?.heading) ?? "Section";
  const body = text(section?.text);
  const index = count(section?.index);
  const total = count(result.totalSections);

  return (
    <>
      <ExplorationTitle href={sessionHref(result.sessionId)} size="md">
        {heading}
      </ExplorationTitle>
      {body && <p className={styles.excerpt}>{body}</p>}
      <Meta>
        {joinMeta("Section read", index !== null && total !== null && `${index + 1} of ${total}`)}
      </Meta>
    </>
  );
}

/** Drawer tools act on one node in place: a single node row with its action. */
function DrawerView({
  toolKey,
  args,
  result,
  onOpenNode,
}: {
  toolKey: string;
  args: Rec | null;
  result: Rec | null;
  onOpenNode: (nodeId: string) => void;
}) {
  const subject = text(result?.title, result?.nodeTitle) ?? subjectOf(args);
  const drawerNode =
    result?.ok === true && DRAWER_TOOLS.has(toolKey)
      ? text(result?.nodeId, result?.activeNodeId)
      : null;

  return (
    <>
      {subject && (
        <NodeTree
          label="Rabbit hole node"
          rows={[{ id: "node", title: subject, depth: 0, tone: drawerNode ? "new" : undefined }]}
        />
      )}
      <Meta>{DRAWER_DONE[toolKey] ?? "Rabbit hole response"}</Meta>
      {drawerNode && <ViewArticle nodeId={drawerNode} onOpen={onOpenNode} />}
    </>
  );
}

// ─── Entry ───────────────────────────────────────────────────────────────────

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
  const confirmed = result?.ok === true;

  let body: ReactNode;

  if (pending) {
    body = <PendingView args={args} toolKey={key} />;
  } else if (failed) {
    body = <ErrorView args={args} output={output} result={result} />;
  } else if (CREATE_TOOLS.has(key) && confirmed && result) {
    body = (
      <CreateView
        args={args}
        loadKeyPoints={loadKeyPoints}
        result={result}
        toolKey={key}
        onOpenNode={onOpenNode}
      />
    );
  } else if (key === "search_rabbit_holes" && result && Array.isArray(result.results)) {
    const hits = records(result.results);

    body = (
      <ExplorationsView
        emptyText="Nothing in your rabbit holes matches this yet."
        heading={<>“{text(result.query, args?.query) ?? "Search"}”</>}
        hits={hits}
        terms={[...new Set(hits.flatMap((hit) => strings(hit.matchedTerms)))]}
        total={hits.length}
      />
    );
  } else if (key === "list_rabbit_holes" && result && Array.isArray(result.sessions)) {
    const sessions = records(result.sessions);

    body = (
      <ExplorationsView
        emptyText="No rabbit holes yet."
        heading="Your rabbit holes"
        hits={sessions}
        terms={[]}
        total={count(result.totalCount) ?? sessions.length}
      />
    );
  } else if (key === "get_rabbit_hole" && confirmed && result) {
    body = <SessionView result={result} />;
  } else if (key === "get_rabbit_hole_node" && confirmed && result) {
    body = <ArticleView result={result} />;
  } else if (key === "get_rabbit_hole_node_section" && confirmed && result) {
    body = <SectionView result={result} />;
  } else if (CREATE_TOOLS.has(key) && !DRAWER_TOOLS.has(key)) {
    // Malformed or historical output: never claim the creation happened.
    body = <Meta>Rabbit hole response</Meta>;
  } else {
    body = <DrawerView args={args} result={result} toolKey={key} onOpenNode={onOpenNode} />;
  }

  const card = (
    <section
      className={cn("not-prose", styles.card, className)}
      data-organic-tool-presence={toolName}
      data-rabbit-hole-tool=""
      data-tool-state={pending ? "in-flight" : failed ? "error" : "complete"}
    >
      {body}
      {showToolDetails && !pending && output != null && <ToolDetails output={output} />}
    </section>
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
