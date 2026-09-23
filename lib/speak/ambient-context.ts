import "server-only";

import type { RabbitHoleNode, RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import { getSessionById, getRabbitHoleSessionOwnerId } from "@/data/supabase/rabbitholes";
import { getConversationSummary, getThreadOwnerContext } from "@/data/supabase/chat";
import { getStrataPageById } from "@/data/supabase/strata";
import { createLogger } from "@/lib/logger";
import { collectAncestorNodeIds } from "@/lib/rabbit-holes/collect-related-nodes";
import { AMBIENT_CLEARED_BODY } from "@/lib/speak/ambient-item";
import { estimateSpeakTokens, SPEAK_CHARS_PER_TOKEN } from "@/lib/speak/token-limit";

const logger = createLogger("lib/speak/ambient-context.ts");

/**
 * Ambient context is re-sent on every navigation and every item is re-read on every model turn,
 * so it is budgeted far tighter than the one-off resume preamble
 * (`SPEAK_CONTEXT_MAX_TOKENS`, ~1.8k). A user bouncing between five surfaces during one session
 * should cost roughly what a single resume costs.
 */
export const SPEAK_AMBIENT_MAX_TOKENS = 600;

/** Compiled Strata documents and rabbit-hole articles are long; clip before budgeting. */
const STRATA_SECTION_MAX_CHARS = 1_400;
const CHAT_SUMMARY_MAX_CHARS = 1_400;

/**
 * The open node is what the user is reading, so its summary gets the largest share. Stored
 * summaries run to ~1,500 words and lead with topic and main claims, so the opening is the part
 * worth keeping. Sized so the lead plus a useful graph always fit {@link SPEAK_AMBIENT_MAX_TOKENS}.
 */
const ACTIVE_NODE_SUMMARY_MAX_CHARS = 1_000;
const QUESTION_MAX_CHARS = 160;
const NODE_LABEL_MAX_CHARS = 60;

/**
 * The graph stops at this many nodes or at the budget the lead leaves, whichever comes first.
 * Enough to answer "where am I" and "what else have I opened"; the rest is counted, not listed.
 */
const RABBIT_HOLE_GRAPH_MAX_NODES = 16;

const RABBIT_HOLE_GRAPH_HEADING =
  "Map of the rabbit hole (indented = branched from the node above):";

/** Room held back for the "(…and N more nodes not shown)" line. */
const RABBIT_HOLE_GRAPH_MORE_RESERVE = 40;

export type AmbientContextDeps = {
  getConversationSummary: typeof getConversationSummary;
  getThreadOwnerContext: typeof getThreadOwnerContext;
  getStrataPageById: typeof getStrataPageById;
  getSessionById: typeof getSessionById;
  getRabbitHoleSessionOwnerId: typeof getRabbitHoleSessionOwnerId;
};

const defaultDeps: AmbientContextDeps = {
  getConversationSummary,
  getThreadOwnerContext,
  getStrataPageById,
  getSessionById,
  getRabbitHoleSessionOwnerId,
};

function clip(text: string, max: number): string {
  const trimmed = text.trim();

  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Trims from the tail until the body fits. Sections are emitted most-important-first by each
 * builder, so dropping the tail degrades gracefully: the model keeps "what is open" even when
 * it loses "what it says".
 */
export function fitAmbientBody(
  sections: string[],
  maxTokens: number = SPEAK_AMBIENT_MAX_TOKENS
): string {
  const working = [...sections].filter((s) => s.trim().length > 0);

  let text = working.join("\n\n");

  while (working.length > 1 && estimateSpeakTokens(text) > maxTokens) {
    working.pop();
    text = working.join("\n\n");
  }

  // A single oversized section (one enormous Strata doc) still has to be cut.
  if (working.length === 1 && estimateSpeakTokens(text) > maxTokens) {
    text = clip(text, maxTokens * 4);
  }

  return text;
}

/**
 * The rolling summary carries the topic, so the thread title is deliberately not fetched — it
 * would cost a second query to restate what the next line already says.
 */
export function buildChatSections(summary: string | null): string[] {
  if (!summary?.trim()) {
    return ["The user has a text chat open on screen. It has no summary yet."];
  }

  return [
    "The user has a text chat open on screen.",
    `What that conversation has covered so far:\n${clip(summary, CHAT_SUMMARY_MAX_CHARS)}`,
  ];
}

/**
 * Strata's compiled document is the elaborated section when it exists, falling back down the
 * pipeline to refined and then raw text. Design and AI instruction sections are authoring
 * controls, not content the user is reading, so they are left out.
 */
export function buildStrataSections(page: StrataPageWithSections): string[] {
  const title = page.page.title?.trim() || "an untitled Strata page";
  const compiled =
    page.sections.elaborated.content.trim() ||
    page.sections.refined_text.content.trim() ||
    page.sections.raw_text.content.trim();

  if (!compiled) {
    return [`The user has the Strata page "${title}" open. It is still empty.`];
  }

  const stage = page.sections.elaborated.content.trim()
    ? "elaborated"
    : page.sections.refined_text.content.trim()
      ? "refined"
      : "raw";

  return [
    `The user has the Strata page "${title}" open on screen.`,
    `Its compiled document (${stage} layer):\n${clip(compiled, STRATA_SECTION_MAX_CHARS)}`,
  ];
}

function nodeLabel(node: RabbitHoleNode): string {
  return clip(node.title?.trim() || node.userQuestion?.trim() || "Untitled", NODE_LABEL_MAX_CHARS);
}

type RabbitHoleTree = {
  entries: Map<string, { label: string; parentId: string | null; position: number }>;
  childrenOf: Map<string, string[]>;
};

/**
 * Parent links come from `path`, the same source the article generator's graph context uses
 * (`lib/rabbit-holes/collect-related-nodes.ts`). `edges` mirrors them but also admits
 * non-tree `reference` / `source` types, so it is not consulted.
 */
function rabbitHoleTree(session: RabbitHoleSession): RabbitHoleTree {
  const entries: RabbitHoleTree["entries"] = new Map();
  const childrenOf: RabbitHoleTree["childrenOf"] = new Map();

  session.path.forEach((seg, position) => {
    if (entries.has(seg.nodeId)) return;

    const node = session.nodesById[seg.nodeId];

    entries.set(seg.nodeId, {
      label: node ? nodeLabel(node) : clip(seg.label, NODE_LABEL_MAX_CHARS),
      parentId: seg.parentNodeId,
      position,
    });

    if (seg.parentNodeId) {
      childrenOf.set(seg.parentNodeId, [...(childrenOf.get(seg.parentNodeId) ?? []), seg.nodeId]);
    }
  });

  return { entries, childrenOf };
}

/**
 * "Where am I" first — the open node, its ancestry nearest-first, then its children — and the
 * rest breadth-first from the roots, so a node is never queued before its parent.
 */
function graphPriority(
  session: RabbitHoleSession,
  tree: RabbitHoleTree,
  activeNodeId: string | null
): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const take = (id: string) => {
    if (seen.has(id) || !tree.entries.has(id)) return;

    seen.add(id);
    order.push(id);
  };

  if (activeNodeId) {
    collectAncestorNodeIds(session, activeNodeId).forEach(take);
    (tree.childrenOf.get(activeNodeId) ?? []).forEach(take);
  }

  const queue = [...tree.entries]
    .filter(([, entry]) => !entry.parentId || !tree.entries.has(entry.parentId))
    .map(([id]) => id);

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;

    take(id);
    queue.push(...(tree.childrenOf.get(id) ?? []));
  }

  return order;
}

/**
 * Indented outline of the shown nodes. A node whose parent exists but was cut is rendered as a
 * top level prefixed with `… ›`, so a truncated ancestry never reads as the root.
 */
function renderRabbitHoleTree(
  tree: RabbitHoleTree,
  shown: ReadonlySet<string>,
  activeNodeId: string | null
): string {
  const lines: string[] = [];

  const visit = (id: string, depth: number, cutAbove: boolean) => {
    const marker = id === activeNodeId ? " ← on screen" : "";

    lines.push(
      `${"  ".repeat(depth)}- ${cutAbove ? "… › " : ""}${tree.entries.get(id)!.label}${marker}`
    );

    for (const child of tree.childrenOf.get(id) ?? []) {
      if (shown.has(child)) visit(child, depth + 1, false);
    }
  };

  const tops = [...shown]
    .filter((id) => {
      const parentId = tree.entries.get(id)!.parentId;

      return !parentId || !shown.has(parentId);
    })
    .sort((a, b) => tree.entries.get(a)!.position - tree.entries.get(b)!.position);

  for (const id of tops) {
    const parentId = tree.entries.get(id)!.parentId;

    visit(id, 0, Boolean(parentId && tree.entries.has(parentId)));
  }

  return lines.join("\n");
}

/**
 * The exploration's shape, sized to `maxChars` by adding nodes in priority order until the next
 * one would not fit. A single-node hole returns nothing: a map of one point says nothing the
 * header has not.
 */
export function buildRabbitHoleGraphSection(
  session: RabbitHoleSession,
  activeNodeId: string | null,
  maxChars: number
): string {
  const tree = rabbitHoleTree(session);

  if (tree.entries.size <= 1) return "";

  const bodyBudget =
    maxChars - RABBIT_HOLE_GRAPH_HEADING.length - RABBIT_HOLE_GRAPH_MORE_RESERVE - 1;
  const shown = new Set<string>();
  let body = "";

  for (const id of graphPriority(session, tree, activeNodeId).slice(
    0,
    RABBIT_HOLE_GRAPH_MAX_NODES
  )) {
    shown.add(id);

    const next = renderRabbitHoleTree(tree, shown, activeNodeId);

    if (shown.size > 1 && next.length > bodyBudget) {
      shown.delete(id);
      break;
    }

    body = next;
  }

  const hidden = tree.entries.size - shown.size;
  const more = hidden > 0 ? `\n(…and ${hidden} more node${hidden === 1 ? "" : "s"} not shown)` : "";

  return `${RABBIT_HOLE_GRAPH_HEADING}\n${body}${more}`;
}

/**
 * The stored summary when there is one, falling back to takeaways and then the quick preview. A
 * node still generating says so, so the model does not present a preview as the finished article.
 */
function buildActiveNodeSection(session: RabbitHoleSession, node: RabbitHoleNode): string {
  const label = nodeLabel(node);
  const question = node.userQuestion?.trim();
  const asked =
    question && question !== label
      ? ` (the user asked: "${clip(question, QUESTION_MAX_CHARS)}")`
      : "";

  if (session.generatingNodeId === node.id && !node.articleHtml?.trim()) {
    const preview = node.preview?.trim();

    return preview
      ? `"${label}"${asked} is still being written. Early preview:\n${clip(preview, ACTIVE_NODE_SUMMARY_MAX_CHARS)}`
      : `"${label}"${asked} is still being written, so there is nothing to summarize yet.`;
  }

  const gist = node.summary?.trim() || node.keyTakeaways?.join("; ") || node.preview?.trim();

  return gist
    ? `What "${label}"${asked} covers:\n${clip(gist, ACTIVE_NODE_SUMMARY_MAX_CHARS)}`
    : "";
}

/**
 * What the user is reading, then where it sits. The open node's summary leads because it is the
 * thing on screen; the graph follows and is sized to the budget the lead leaves, so
 * `fitAmbientBody` never has to drop it whole.
 */
export function buildRabbitHoleSections(
  session: RabbitHoleSession,
  activeNodeId: string | null,
  maxTokens: number = SPEAK_AMBIENT_MAX_TOKENS
): string[] {
  const active = activeNodeId ? session.nodesById[activeNodeId] : undefined;
  const root = session.rootQuestion.trim();
  const hole = root ? `the rabbit hole "${clip(root, QUESTION_MAX_CHARS)}"` : "a new rabbit hole";

  const lead = active
    ? [
        `The user is reading ${hole}, on the node "${nodeLabel(active)}".`,
        buildActiveNodeSection(session, active),
      ]
    : [`The user has ${hole} open.`];

  // Two characters for the blank line `fitAmbientBody` joins with.
  const remaining =
    maxTokens * SPEAK_CHARS_PER_TOKEN - lead.filter(Boolean).join("\n\n").length - 2;

  return [...lead, buildRabbitHoleGraphSection(session, active?.id ?? null, remaining)];
}

export type AmbientContextResult = {
  /** Body for the system item, already budgeted. Empty when the surface yields nothing. */
  body: string;
  /** Echoed so the client can cache-key without re-deriving it. */
  surfaceKey: string;
};

/**
 * Resolves a surface descriptor into ambient text, enforcing ownership at every branch.
 *
 * A surface the caller does not own resolves to an empty body rather than an error: the user may
 * legitimately have navigated to something shared or stale, and a failed ambient push must never
 * take down a live call.
 */
export async function buildAmbientContext(
  args: { ownerId: string; surface: SpeakScreenSurface },
  deps: AmbientContextDeps = defaultDeps
): Promise<string> {
  const { ownerId, surface } = args;

  try {
    switch (surface.kind) {
      case "none":
        return AMBIENT_CLEARED_BODY;

      case "chat": {
        const owner = await deps.getThreadOwnerContext(surface.id);

        if (owner.error || owner.data?.ownerId !== ownerId) return "";

        const summary = await deps.getConversationSummary(surface.id);

        return fitAmbientBody(buildChatSections(summary.data ?? null));
      }

      case "stratum": {
        const page = await deps.getStrataPageById(surface.id);

        if (!page || page.page.owner_id !== ownerId) return "";

        return fitAmbientBody(buildStrataSections(page));
      }

      case "rabbit-hole": {
        const owner = await deps.getRabbitHoleSessionOwnerId(surface.id);

        if (owner !== ownerId) return "";

        const session = await deps.getSessionById(surface.id);

        if (session.error || !session.data) return "";

        return fitAmbientBody(
          buildRabbitHoleSections(session.data, surface.activeNodeId ?? session.data.activeNodeId)
        );
      }
    }
  } catch (error) {
    // Ambient context is an enhancement; a live call must survive its failure.
    logger.warn(
      "buildAmbientContext",
      `Failed to build ${surface.kind} context: ${error instanceof Error ? error.message : String(error)}`
    );

    return "";
  }
}
