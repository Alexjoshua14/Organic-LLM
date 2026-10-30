import type { RabbitHoleNode, RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";
import { stripControlAndZeroWidth } from "@/lib/security/external-content/extract-text";

/**
 * Pure shaping for the rabbit hole read tools: how much of a session or node a caller sees.
 *
 * - `high_level` — identity and graph structure (ids + titles), plus a node's section outline.
 * - `overview`   — high_level plus key takeaways.
 * - `detailed`   — everything: article text, sources, branch suggestions.
 */
export const RABBIT_HOLE_DETAIL_LEVELS = ["high_level", "overview", "detailed"] as const;
export type RabbitHoleDetail = (typeof RABBIT_HOLE_DETAIL_LEVELS)[number];

/**
 * Temporary development guard: the most rabbit hole content one tool call may return. It is
 * enforced by the tool wrappers, not by the shaping functions here, so the readers stay honest
 * about what a session holds.
 */
export const RABBIT_HOLE_TOOL_RESPONSE_TOKEN_CAP = 150_000;

const DESCRIPTION_MAX_CHARS = 400;
const CHARS_PER_TOKEN = 4;

/** Rough token estimate (chars / 4). Good enough for a spend guard, not for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function rabbitHoleSessionUrl(sessionId: string): string {
  return `/rabbitholes?sessionId=${encodeURIComponent(sessionId)}`;
}

// ── HTML → text and sections ────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * Article HTML to readable plain text, keeping headings (`## `) and paragraph breaks.
 * Tags are stripped before entities are decoded, so escaped markup stays literal text.
 */
export function articleHtmlToText(html: string): string {
  const stripped = html
    .replace(/<\s*h[1-6][^>]*>/gi, "\n\n## ")
    .replace(/<\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(?:p|li|div|section|ul|ol|blockquote|pre|table|tr)\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");

  return stripControlAndZeroWidth(decodeEntities(stripped))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type RabbitHoleNodeSection = {
  /** Position in the node's section list; the handle `get_rabbit_hole_node_section` takes. */
  index: number;
  /** DOM id from the article (the generator emits `takeaway-N`), when present. */
  id: string | null;
  heading: string;
  html: string;
};

const H2_PATTERN = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;

function headingText(innerHtml: string): string {
  return articleHtmlToText(innerHtml).replace(/\s+/g, " ").trim();
}

/**
 * Split article HTML at its `<h2>` headings. Text before the first heading becomes an
 * "Introduction" section; an article with no `<h2>` at all is a single section.
 */
export function parseArticleSections(
  html: string | null | undefined,
  fallbackHeading = RABBIT_HOLE_UNTITLED
): RabbitHoleNodeSection[] {
  const source = html?.trim();

  if (!source) return [];

  const matches = [...source.matchAll(new RegExp(H2_PATTERN.source, "gi"))];

  if (matches.length === 0) {
    return [{ index: 0, id: null, heading: fallbackHeading, html: source }];
  }

  const bounds = matches.map((m) => m.index ?? 0);
  const sections: Omit<RabbitHoleNodeSection, "index">[] = [];
  const preamble = source.slice(0, bounds[0]);

  if (articleHtmlToText(preamble)) {
    sections.push({ id: null, heading: "Introduction", html: preamble.trim() });
  }

  matches.forEach((match, i) => {
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(match[1] ?? "");

    sections.push({
      id: idMatch?.[1] ?? null,
      heading: headingText(match[2] ?? "") || `Section ${i + 1}`,
      html: source.slice(bounds[i], bounds[i + 1] ?? source.length).trim(),
    });
  });

  return sections.map((section, index) => ({ index, ...section }));
}

/** One section by index or DOM id, or null when neither resolves. */
export function findArticleSection(
  sections: RabbitHoleNodeSection[],
  target: { sectionIndex?: number; sectionId?: string }
): RabbitHoleNodeSection | null {
  if (target.sectionId !== undefined) {
    return sections.find((s) => s.id === target.sectionId) ?? null;
  }

  if (target.sectionIndex !== undefined) {
    return sections.find((s) => s.index === target.sectionIndex) ?? null;
  }

  return null;
}

// ── Graph ───────────────────────────────────────────────────────────────────

export type RabbitHoleGraphEntry = {
  nodeId: string;
  title: string;
  parentNodeId: string | null;
};

export function nodeDisplayTitle(
  node: RabbitHoleNode | undefined,
  pathLabel?: string | null
): string {
  const title = node?.title?.trim();

  if (title) return title;
  if (pathLabel && pathLabel !== RABBIT_HOLE_UNTITLED) return pathLabel;

  return node?.userQuestion?.trim().slice(0, 80) || RABBIT_HOLE_UNTITLED;
}

/** Nodes in creation order with their parent. Path segments carry the parent link. */
export function buildGraphEntries(session: RabbitHoleSession): RabbitHoleGraphEntry[] {
  const entries: RabbitHoleGraphEntry[] = [];
  const seen = new Set<string>();

  for (const segment of session.path) {
    if (seen.has(segment.nodeId)) continue;
    seen.add(segment.nodeId);

    const incomingEdge = session.edges?.find((e) => e.to === segment.nodeId && e.type !== "source");

    entries.push({
      nodeId: segment.nodeId,
      title: nodeDisplayTitle(session.nodesById[segment.nodeId], segment.label),
      parentNodeId: segment.parentNodeId ?? incomingEdge?.from ?? null,
    });
  }

  for (const node of Object.values(session.nodesById)) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    entries.push({ nodeId: node.id, title: nodeDisplayTitle(node), parentNodeId: null });
  }

  return entries;
}

export function sessionTitle(session: RabbitHoleSession): string {
  const root = session.rootNodeId ? session.nodesById[session.rootNodeId] : undefined;
  const rootLabel = session.path[0]?.label;

  return (
    root?.title?.trim() ||
    (rootLabel && rootLabel !== RABBIT_HOLE_UNTITLED ? rootLabel : "") ||
    session.rootQuestion?.trim() ||
    RABBIT_HOLE_UNTITLED
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function sessionDescription(session: RabbitHoleSession): string {
  const root = session.rootNodeId ? session.nodesById[session.rootNodeId] : undefined;
  const text = root?.summary?.trim() || root?.preview?.trim() || session.rootQuestion?.trim() || "";

  return truncate(text, DESCRIPTION_MAX_CHARS);
}

// ── Node shaping ────────────────────────────────────────────────────────────

type NodeStatus = "ready" | "generating" | "empty";

function nodeStatus(session: RabbitHoleSession, node: RabbitHoleNode): NodeStatus {
  if (node.articleHtml?.trim()) return "ready";

  return session.generatingNodeId === node.id ? "generating" : "empty";
}

function childIdsOf(entries: RabbitHoleGraphEntry[], nodeId: string): string[] {
  return entries.filter((e) => e.parentNodeId === nodeId).map((e) => e.nodeId);
}

export function shapeRabbitHoleNode(
  session: RabbitHoleSession,
  node: RabbitHoleNode,
  detail: RabbitHoleDetail
) {
  const entries = buildGraphEntries(session);
  const entry = entries.find((e) => e.nodeId === node.id);
  const title = entry?.title ?? nodeDisplayTitle(node);
  const sections = parseArticleSections(node.articleHtml, title);

  const base = {
    sessionId: session.sessionId,
    nodeId: node.id,
    title,
    userQuestion: node.userQuestion,
    createdAt: node.createdAt,
    parentNodeId: entry?.parentNodeId ?? null,
    childNodeIds: childIdsOf(entries, node.id),
    status: nodeStatus(session, node),
    sections: sections.map(({ index, id, heading }) => ({ index, id, heading })),
  };

  if (detail === "high_level") return base;

  const withTakeaways = { ...base, keyTakeaways: node.keyTakeaways ?? [] };

  if (detail === "overview") return withTakeaways;

  return {
    ...withTakeaways,
    summary: node.summary ?? null,
    articleText: node.articleHtml ? articleHtmlToText(node.articleHtml) : "",
    sources: (node.sources ?? []).map((s) => ({ title: s.title, url: s.url })),
    branchSuggestions: (node.branchSuggestions ?? []).map((b) => ({
      label: b.label,
      description: b.shortDescription ?? null,
    })),
  };
}

export function shapeRabbitHoleSession(session: RabbitHoleSession, detail: RabbitHoleDetail) {
  const entries = buildGraphEntries(session);

  const base = {
    sessionId: session.sessionId,
    title: sessionTitle(session),
    description: sessionDescription(session),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt ?? session.createdAt,
    url: rabbitHoleSessionUrl(session.sessionId),
    rootNodeId: session.rootNodeId ?? null,
    generatingNodeId: session.generatingNodeId ?? null,
    nodeCount: entries.length,
  };

  if (detail === "high_level") {
    return { ...base, nodes: entries };
  }

  if (detail === "overview") {
    return {
      ...base,
      nodes: entries.map((entry) => ({
        ...entry,
        keyTakeaways: session.nodesById[entry.nodeId]?.keyTakeaways ?? [],
      })),
    };
  }

  return {
    ...base,
    nodes: entries.flatMap((entry) => {
      const node = session.nodesById[entry.nodeId];

      return node ? [shapeRabbitHoleNode(session, node, "detailed")] : [];
    }),
  };
}
