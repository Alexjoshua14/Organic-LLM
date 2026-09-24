import "server-only";

import type { UIMessage } from "ai";
import type { RabbitHoleNode, RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import { getSessionById, getRabbitHoleSessionOwnerId } from "@/data/supabase/rabbitholes";
import {
  getConversationSummary,
  getNMessages,
  getThreadOwnerContext,
  getThreadTitle,
} from "@/data/supabase/chat";
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

/**
 * The latest messages are what is on screen, so they get their own cap rather than whatever the
 * budget leaves. It is deliberately a fraction of the budget: every push is re-read on every model
 * turn, so sending a thread's recent history must not become a second copy of the chat.
 */
export const CHAT_RECENT_MAX_TOKENS = 300;
/** Fetched newest-first; the token cap usually binds before this does. */
const CHAT_RECENT_MESSAGE_LIMIT = 6;
/** One long answer must not crowd out the turn before it. */
const CHAT_MESSAGE_MAX_CHARS = 600;
const CHAT_TITLE_MAX_CHARS = 120;
/** Below this, a clipped summary says too little to be worth the tokens. */
const CHAT_SUMMARY_MIN_CHARS = 80;
const CHAT_RECENT_HEADING = "Latest messages, oldest first:";
const CHAT_SUMMARY_HEADING = "What the conversation has covered so far:";

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
  getNMessages: typeof getNMessages;
  getThreadOwnerContext: typeof getThreadOwnerContext;
  getThreadTitle: typeof getThreadTitle;
  getStrataPageById: typeof getStrataPageById;
  getSessionById: typeof getSessionById;
  getRabbitHoleSessionOwnerId: typeof getRabbitHoleSessionOwnerId;
};

const defaultDeps: AmbientContextDeps = {
  getConversationSummary,
  getNMessages,
  getThreadOwnerContext,
  getThreadTitle,
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

export type ChatScreen = {
  title: string | null;
  /** Chronological, newest last — as `getNMessages` returns them. */
  messages: UIMessage[];
  summary: string | null;
};

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Walks back from the newest message until the next one would not fit, then reads oldest first.
 * The newest always makes it in — clipped to the cap if it alone overflows — because it is the
 * one the user just read. Tool calls, reasoning and generated UI are left out; only what was said.
 */
export function buildRecentMessagesSection(messages: UIMessage[], maxChars: number): string {
  const budget = maxChars - CHAT_RECENT_HEADING.length - 1;
  const lines: string[] = [];
  let used = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;

    if (message.role !== "user" && message.role !== "assistant") continue;

    const text = messageText(message);

    if (!text) continue;

    const line = `${message.role === "user" ? "User" : "Assistant"}: ${clip(text, CHAT_MESSAGE_MAX_CHARS)}`;
    const cost = line.length + (lines.length > 0 ? 1 : 0);

    if (used + cost > budget) {
      if (lines.length === 0 && budget > 0) lines.push(clip(line, budget));
      break;
    }

    lines.push(line);
    used += cost;
  }

  return lines.length > 0 ? `${CHAT_RECENT_HEADING}\n${lines.reverse().join("\n")}` : "";
}

/**
 * Title, then the latest messages, then the rolling summary. The messages are what is on screen,
 * so they lead and have their own cap ({@link CHAT_RECENT_MAX_TOKENS}); the summary is background
 * and is sized to what the budget has left, so `fitAmbientBody` never drops it whole.
 */
export function buildChatSections(
  chat: ChatScreen,
  maxTokens: number = SPEAK_AMBIENT_MAX_TOKENS
): string[] {
  const title = chat.title?.trim();
  const header = title
    ? `The user has the chat "${clip(title, CHAT_TITLE_MAX_CHARS)}" open.`
    : "The user has an untitled chat open.";
  const recent = buildRecentMessagesSection(
    chat.messages,
    CHAT_RECENT_MAX_TOKENS * SPEAK_CHARS_PER_TOKEN
  );
  const summary = chat.summary?.trim();

  if (!recent && !summary) return [header, "It has no messages yet."];

  const lead = [header, recent].filter(Boolean);
  // Two characters per blank line `fitAmbientBody` joins with.
  const room =
    maxTokens * SPEAK_CHARS_PER_TOKEN -
    lead.join("\n\n").length -
    2 -
    CHAT_SUMMARY_HEADING.length -
    1;

  return summary && room >= CHAT_SUMMARY_MIN_CHARS
    ? [...lead, `${CHAT_SUMMARY_HEADING}\n${clip(summary, room)}`]
    : lead;
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

/** Why a surface produced no body. Surfaced to the dev "Sees:" chip, never to the model. */
export type AmbientSkipReason = "not-owner" | "not-found" | "error";

export type AmbientContext = {
  /** Body for the screen item, already budgeted. Empty when the surface yields nothing. */
  body: string;
  /** Short name for what is on screen — "Chat · Espresso grinders" — for logs and the dev chip. */
  label: string;
  /** Set when `body` is empty, saying why. */
  reason?: AmbientSkipReason;
};

const KIND_LABEL: Record<SpeakScreenSurface["kind"], string> = {
  chat: "Chat",
  stratum: "Strata",
  "rabbit-hole": "Rabbit hole",
  none: "Nothing on screen",
};

/**
 * Resolves a surface descriptor into ambient text, enforcing ownership at every branch.
 *
 * A surface the caller does not own, or one that fails to load, resolves to an empty body with a
 * `reason` rather than an error: the user may legitimately have navigated to something shared or
 * stale, and a failed ambient push must never take down a live call. The client replaces the
 * previous screen item with {@link AMBIENT_CLEARED_BODY} in that case.
 */
export async function buildAmbientContext(
  args: { ownerId: string; surface: SpeakScreenSurface },
  deps: AmbientContextDeps = defaultDeps
): Promise<AmbientContext> {
  const { ownerId, surface } = args;
  const kind = KIND_LABEL[surface.kind];
  const skip = (reason: AmbientSkipReason): AmbientContext => ({ body: "", label: kind, reason });

  try {
    switch (surface.kind) {
      case "none":
        return { body: AMBIENT_CLEARED_BODY, label: kind };

      case "chat": {
        const owner = await deps.getThreadOwnerContext(surface.id);

        if (owner.error || !owner.data) return skip("not-found");
        if (owner.data.ownerId !== ownerId) return skip("not-owner");

        const [title, messages, summary] = await Promise.all([
          deps.getThreadTitle(surface.id),
          deps.getNMessages(surface.id, CHAT_RECENT_MESSAGE_LIMIT),
          deps.getConversationSummary(surface.id),
        ]);
        const chat: ChatScreen = {
          title: title.data ?? null,
          messages: messages.data ?? [],
          summary: summary.data ?? null,
        };

        return {
          body: fitAmbientBody(buildChatSections(chat)),
          label: `${kind} · ${chat.title ? clip(chat.title, CHAT_TITLE_MAX_CHARS) : "Untitled"}`,
        };
      }

      case "stratum": {
        const page = await deps.getStrataPageById(surface.id);

        if (!page) return skip("not-found");
        if (page.page.owner_id !== ownerId) return skip("not-owner");

        return {
          body: fitAmbientBody(buildStrataSections(page)),
          label: `${kind} · ${page.page.title?.trim() || "Untitled"}`,
        };
      }

      case "rabbit-hole": {
        const owner = await deps.getRabbitHoleSessionOwnerId(surface.id);

        if (owner !== ownerId) return skip(owner ? "not-owner" : "not-found");

        const session = await deps.getSessionById(surface.id);

        if (session.error || !session.data) return skip("not-found");

        const activeNodeId = surface.activeNodeId ?? session.data.activeNodeId;
        const active = activeNodeId ? session.data.nodesById[activeNodeId] : undefined;

        return {
          body: fitAmbientBody(buildRabbitHoleSections(session.data, activeNodeId)),
          label: `${kind} · ${active ? nodeLabel(active) : clip(session.data.rootQuestion, NODE_LABEL_MAX_CHARS) || "New"}`,
        };
      }
    }
  } catch (error) {
    // Ambient context is an enhancement; a live call must survive its failure.
    logger.warn(
      "buildAmbientContext",
      `Failed to build ${surface.kind} context: ${error instanceof Error ? error.message : String(error)}`
    );

    return skip("error");
  }
}
