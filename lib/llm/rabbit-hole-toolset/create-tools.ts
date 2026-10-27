import type { RabbitHoleToolsetDeps } from "./deps";
import type { RabbitHoleStreamWriter } from "@/lib/llm/rabbit-hole-assistant-tools";

import { tool } from "ai";
import { z } from "zod";

import { loadOwnedSession } from "./access";
import { buildGraphEntries, rabbitHoleSessionUrl } from "./shape";

import { createLogger } from "@/lib/logger";
import { draftGeneratedRabbitHoleNode } from "@/lib/rabbit-holes/draft-node";
import { buildEmptyRabbitHoleSession } from "@/lib/rabbit-holes/new-session";

const logger = createLogger("lib/llm/rabbit-hole-toolset/create-tools.ts");

export const CREATE_RABBIT_HOLE_TOOL_NAME = "create_rabbit_hole";
export const CREATE_RABBIT_HOLE_NODE_TOOL_NAME = "create_rabbit_hole_node";

const ONE_PER_TURN = "Only one rabbit hole or node may be created per assistant turn.";
const VALID_PARENTS_SHOWN = 40;

/**
 * A generation flag older than this is treated as abandoned, so a failed run cannot block a
 * rabbit hole forever.
 */
const STALE_GENERATION_MS = 10 * 60_000;

type CreateToolsOptions = {
  sbUserId: string;
  deps: RabbitHoleToolsetDeps;
  /** Rabbit hole drawer only: lets a node created in the open session pull the viewport to it. */
  writer?: RabbitHoleStreamWriter;
  /** The session the user is viewing, when there is one. */
  currentSessionId?: string;
  /** Parent to use when the caller names none (the drawer passes the active node). */
  getDefaultParentNodeId?: (sessionId: string) => string | null;
};

/**
 * Create category of the rabbit hole toolset.
 *
 * These tools never ask the user anything. Approval is the calling agent's job: an explicit
 * instruction such as "create this as a rabbit hole" is approval. What they do enforce is
 * ownership, the same spend gates as the `/generate` route, and one creation per turn.
 */
export function createRabbitHoleCreateTools({
  sbUserId,
  deps,
  writer,
  currentSessionId,
  getDefaultParentNodeId,
}: CreateToolsOptions) {
  // Tools are built once per chat request, so this spans every step of the assistant turn. The
  // claim is taken synchronously, so two parallel calls in one step cannot both pass; a call that
  // fails before scheduling gives it back.
  let creationClaimed = false;

  function claimCreation(): (() => void) | null {
    if (creationClaimed) return null;

    creationClaimed = true;

    return () => {
      creationClaimed = false;
    };
  }

  const create_rabbit_hole = tool({
    description:
      "Start a new rabbit hole session: a root article generated in the background. Before calling, search_rabbit_holes — if an existing rabbit hole covers the subject, use create_rabbit_hole_node on it instead of starting a disjoint one. Does not ask the user for approval; you must have it (an explicit request counts). At most one creation per turn.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(2000)
        .describe(
          "The topic to explore, as a focused question or short phrase. It is refined before generation, so length and format directions do not carry through."
        ),
      title: z.string().min(1).max(80).optional().describe("Short title, up to 80 characters."),
    }),
    execute: async ({ query, title }) => {
      const release = claimCreation();

      if (!release) return { ok: false as const, error: ONE_PER_TURN };

      let scheduled = false;

      try {
        const spend = await deps.checkSpend(sbUserId);

        if (!spend.ok) return { ok: false as const, error: spend.error };

        const now = deps.now();
        const drafted = draftGeneratedRabbitHoleNode({
          session: buildEmptyRabbitHoleSession({ sessionId: deps.newId(), now }),
          query,
          label: title,
          activeNodeId: null,
          nodeId: deps.newId(),
          now,
        });

        await deps.scheduleGeneration({
          sessionId: drafted.session.sessionId,
          nodeId: drafted.nodeId,
          serializedSession: JSON.stringify(drafted.session),
        });
        scheduled = true;

        return {
          ok: true as const,
          sessionId: drafted.session.sessionId,
          nodeId: drafted.nodeId,
          title: drafted.title,
          status: "generating" as const,
          url: rabbitHoleSessionUrl(drafted.session.sessionId),
        };
      } catch (error) {
        logger.error("create_rabbit_hole", "Failed to start rabbit hole", error);

        return { ok: false as const, error: "Could not start the rabbit hole." };
      } finally {
        if (!scheduled) release();
      }
    },
  });

  const create_rabbit_hole_node = tool({
    description:
      "Add one article node to an existing rabbit hole, generated in the background. Prefer this over create_rabbit_hole when a matching session exists. `parentNodeId` is where the node attaches in the graph (get_rabbit_hole shows node ids); omit it to attach under the root (or the active node, in the rabbit hole drawer). Does not ask the user for approval; you must have it (an explicit request counts). At most one creation per turn.",
    inputSchema: z.object({
      sessionId: z.uuid().describe("The rabbit hole to extend."),
      query: z
        .string()
        .min(1)
        .max(2000)
        .describe(
          "The topic to explore, as a focused question or short phrase. It is refined before generation, so length and format directions do not carry through."
        ),
      parentNodeId: z.string().min(1).optional().describe("Existing node this one branches from."),
      label: z.string().min(1).max(80).optional().describe("Short title, up to 80 characters."),
    }),
    execute: async ({ sessionId, query, parentNodeId, label }) => {
      const release = claimCreation();

      if (!release) return { ok: false as const, error: ONE_PER_TURN };

      let scheduled = false;

      try {
        const owned = await loadOwnedSession(deps, sbUserId, sessionId);

        if (!owned.ok) return owned;

        const { session } = owned;
        const updatedAt = Date.parse(session.updatedAt ?? session.createdAt);
        const generating = session.generatingNodeId
          ? session.nodesById[session.generatingNodeId]
          : undefined;

        if (
          generating &&
          !generating.articleHtml?.trim() &&
          Date.parse(deps.now()) - updatedAt < STALE_GENERATION_MS
        ) {
          return {
            ok: false as const,
            error: "A node in this rabbit hole is still generating. Try again once it finishes.",
          };
        }

        if (parentNodeId !== undefined && !session.nodesById[parentNodeId]) {
          return {
            ok: false as const,
            error:
              "parentNodeId is not a node in this rabbit hole. Pick one of validParents, or omit it.",
            validParents: buildGraphEntries(session)
              .slice(0, VALID_PARENTS_SHOWN)
              .map(({ nodeId, title }) => ({ nodeId, title })),
          };
        }

        const defaultParent = getDefaultParentNodeId?.(sessionId) ?? null;
        const parent =
          parentNodeId ??
          (defaultParent && session.nodesById[defaultParent] ? defaultParent : undefined) ??
          session.rootNodeId ??
          undefined;

        const spend = await deps.checkSpend(sbUserId);

        if (!spend.ok) return { ok: false as const, error: spend.error };

        const drafted = draftGeneratedRabbitHoleNode({
          session,
          query,
          label,
          parentNodeId: parent,
          activeNodeId: null,
          nodeId: deps.newId(),
          now: deps.now(),
        });

        await deps.scheduleGeneration({
          sessionId,
          nodeId: drafted.nodeId,
          serializedSession: JSON.stringify(drafted.session),
        });
        scheduled = true;

        if (writer && sessionId === currentSessionId) {
          writer.write({
            type: "data-rabbit-hole-nav",
            data: { activeNodeId: drafted.nodeId },
            transient: true,
          });
        }

        return {
          ok: true as const,
          sessionId,
          nodeId: drafted.nodeId,
          parentNodeId: parent ?? null,
          title: drafted.title,
          status: "generating" as const,
          url: rabbitHoleSessionUrl(sessionId),
        };
      } catch (error) {
        logger.error("create_rabbit_hole_node", "Failed to add rabbit hole node", error);

        return { ok: false as const, error: "Could not add the node." };
      } finally {
        if (!scheduled) release();
      }
    },
  });

  return { create_rabbit_hole, create_rabbit_hole_node };
}
