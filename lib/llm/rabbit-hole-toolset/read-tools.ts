import type { RabbitHoleToolsetDeps } from "./deps";

import { tool } from "ai";
import { z } from "zod";

import { gateResponseSize, loadOwnedSession } from "./access";
import { searchRabbitHoles } from "./search";
import {
  articleHtmlToText,
  findArticleSection,
  parseArticleSections,
  RABBIT_HOLE_DETAIL_LEVELS,
  rabbitHoleSessionUrl,
  shapeRabbitHoleNode,
  shapeRabbitHoleSession,
} from "./shape";

import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";

export const LIST_RABBIT_HOLES_TOOL_NAME = "list_rabbit_holes";
export const SEARCH_RABBIT_HOLES_TOOL_NAME = "search_rabbit_holes";
export const GET_RABBIT_HOLE_TOOL_NAME = "get_rabbit_hole";
export const GET_RABBIT_HOLE_NODE_TOOL_NAME = "get_rabbit_hole_node";
export const GET_RABBIT_HOLE_NODE_SECTION_TOOL_NAME = "get_rabbit_hole_node_section";

const detailSchema = z
  .enum(RABBIT_HOLE_DETAIL_LEVELS)
  .default("high_level")
  .describe(
    'How much to return. "high_level": title, description, dates and the node graph (ids + titles) — start here. "overview": the same plus each node\'s key takeaways. "detailed": the full article text, sources and branch suggestions; large, use only when you need the content itself.'
  );

const sessionIdSchema = z
  .uuid()
  .describe("A rabbit hole session id, from list_rabbit_holes or search_rabbit_holes.");
const nodeIdSchema = z
  .string()
  .min(1)
  .describe("A node id from the session's graph (get_rabbit_hole).");

const UNREADABLE = "Could not read rabbit holes right now.";

/**
 * Read category of the rabbit hole toolset. Every tool is scoped to `sbUserId`, and every
 * session id the model supplies is ownership-checked before anything is returned.
 */
export function createRabbitHoleReadTools({
  sbUserId,
  deps,
}: {
  sbUserId: string;
  deps: RabbitHoleToolsetDeps;
}) {
  const list_rabbit_holes = tool({
    description:
      "List the user's rabbit hole sessions (newest first) — a session browser. Returns id, title, description, dates and node count for each. Use this to see what exists; use search_rabbit_holes when you are looking for a topic.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).optional().default(30),
    }),
    execute: async ({ limit }) => {
      const res = await deps.listSessions();

      if (res.error || !res.data) return { ok: false as const, error: UNREADABLE };

      return {
        ok: true as const,
        totalCount: res.data.length,
        sessions: res.data.slice(0, limit).map((s) => ({
          sessionId: s.sessionId,
          title: s.rootTitle?.trim() || s.rootQuestion.trim() || RABBIT_HOLE_UNTITLED,
          description: s.summary ?? s.rootQuestion,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          nodeCount: s.pathLength,
          url: rabbitHoleSessionUrl(s.sessionId),
        })),
      };
    },
  });

  const search_rabbit_holes = tool({
    description:
      "Keyword search across the user's rabbit holes (session titles and questions, node titles, questions, key takeaways, summaries). Returns ranked sessions with the nodes that matched. Use short topical keywords, not a sentence. Run this before creating a rabbit hole, to find an existing one to extend.",
    inputSchema: z.object({
      query: z.string().min(1).describe("A few topical keywords, e.g. 'python heapq'."),
      limit: z.number().int().min(1).max(20).optional().default(8),
    }),
    execute: async ({ query, limit }) => {
      const sessionsRes = await deps.listSessions();

      if (sessionsRes.error || !sessionsRes.data) return { ok: false as const, error: UNREADABLE };

      const rowsRes = await deps.getNodeSearchRows(sessionsRes.data.map((s) => s.sessionId));

      if (rowsRes.error || !rowsRes.data) return { ok: false as const, error: UNREADABLE };

      const results = searchRabbitHoles({
        query,
        sessions: sessionsRes.data,
        nodeRows: rowsRes.data,
        limit,
      }).map((hit) => ({ ...hit, url: rabbitHoleSessionUrl(hit.sessionId) }));

      return { ok: true as const, query, resultCount: results.length, results };
    },
  });

  const get_rabbit_hole = tool({
    description:
      "Get one rabbit hole session by id. Choose `detail` to control size: high_level (title, description, date, node graph with ids and titles), overview (adds key takeaways per node), detailed (the whole session's content — large). Start with high_level, then read individual nodes with get_rabbit_hole_node.",
    inputSchema: z.object({ sessionId: sessionIdSchema, detail: detailSchema }),
    execute: async ({ sessionId, detail }) => {
      const owned = await loadOwnedSession(deps, sbUserId, sessionId);

      if (!owned.ok) return owned;

      const gated = gateResponseSize(shapeRabbitHoleSession(owned.session, detail));

      return gated.ok ? { ok: true as const, ...gated.payload } : gated;
    },
  });

  const get_rabbit_hole_node = tool({
    description:
      "Get one node (article) of a rabbit hole by session id and node id. `detail`: high_level (title, question, parent/children, status, and the article's section outline), overview (adds key takeaways), detailed (adds the full article text, sources and branch suggestions). To read just part of an article, use get_rabbit_hole_node_section with an index from the section outline.",
    inputSchema: z.object({
      sessionId: sessionIdSchema,
      nodeId: nodeIdSchema,
      detail: detailSchema,
    }),
    execute: async ({ sessionId, nodeId, detail }) => {
      const owned = await loadOwnedSession(deps, sbUserId, sessionId);

      if (!owned.ok) return owned;

      const node = owned.session.nodesById[nodeId];

      if (!node) {
        return {
          ok: false as const,
          error: `Node not found in this rabbit hole. Use get_rabbit_hole to list its nodes.`,
        };
      }

      const gated = gateResponseSize(shapeRabbitHoleNode(owned.session, node, detail));

      return gated.ok ? { ok: true as const, ...gated.payload } : gated;
    },
  });

  const get_rabbit_hole_node_section = tool({
    description:
      "Get one section of a node's article as plain text. Pass the `sectionIndex` (or `sectionId`) from the node's section outline (get_rabbit_hole_node, detail high_level).",
    inputSchema: z.object({
      sessionId: sessionIdSchema,
      nodeId: nodeIdSchema,
      sectionIndex: z.number().int().min(0).optional(),
      sectionId: z.string().min(1).optional().describe("The section's DOM id, e.g. 'takeaway-1'."),
    }),
    execute: async ({ sessionId, nodeId, sectionIndex, sectionId }) => {
      if (sectionIndex === undefined && sectionId === undefined) {
        return { ok: false as const, error: "Pass sectionIndex or sectionId." };
      }

      const owned = await loadOwnedSession(deps, sbUserId, sessionId);

      if (!owned.ok) return owned;

      const node = owned.session.nodesById[nodeId];

      if (!node) {
        return {
          ok: false as const,
          error: `Node not found in this rabbit hole. Use get_rabbit_hole to list its nodes.`,
        };
      }

      const sections = parseArticleSections(node.articleHtml, node.title ?? node.userQuestion);
      const section = findArticleSection(sections, { sectionIndex, sectionId });

      if (!section) {
        return {
          ok: false as const,
          error: sections.length
            ? `Section not found. This node has sections 0–${sections.length - 1}.`
            : "This node has no article content yet.",
        };
      }

      const gated = gateResponseSize({
        sessionId,
        nodeId,
        totalSections: sections.length,
        section: {
          index: section.index,
          id: section.id,
          heading: section.heading,
          text: articleHtmlToText(section.html),
        },
      });

      return gated.ok ? { ok: true as const, ...gated.payload } : gated;
    },
  });

  return {
    list_rabbit_holes,
    search_rabbit_holes,
    get_rabbit_hole,
    get_rabbit_hole_node,
    get_rabbit_hole_node_section,
  };
}
