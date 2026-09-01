import { tool } from "ai";
import { z } from "zod";

import { scheduleNodeGeneration } from "@/lib/rabbit-holes/scheduleNodeGeneration";
import { getSessionById, saveSession } from "@/data/supabase/rabbitholes";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/llm/rabbit-hole-assistant-tools.ts");

export const NAVIGATE_RABBIT_HOLE_NODE_TOOL_NAME = "navigate_rabbit_hole_node";
export const GENERATE_RABBIT_HOLE_NODE_TOOL_NAME = "generate_rabbit_hole_node";
export const SEARCH_RABBIT_HOLE_CONTEXT_TOOL_NAME = "search_rabbit_hole_context";

export type RabbitHoleStreamWriter = {
  write: (part: {
    type: "data-rabbit-hole-nav";
    data: { activeNodeId: string };
    transient?: boolean;
  }) => void;
};

const nodeCreationAttemptedByMessage = new WeakMap<object, boolean>();

export function createRabbitHoleAssistantTools({
  sessionId,
  sbUserId,
  writer,
  getActiveNodeId,
}: {
  sessionId: string;
  sbUserId: string;
  writer?: RabbitHoleStreamWriter;
  getActiveNodeId: () => string | null;
}) {
  const navigate_rabbit_hole_node = tool({
    description: "Navigate the article viewport to an existing node in the current rabbit hole session.",
    inputSchema: z.object({
      nodeId: z.string().min(1),
    }),
    execute: async ({ nodeId }) => {
      const sessionRes = await getSessionById(sessionId);

      if (sessionRes.error || !sessionRes.data) {
        return { ok: false as const, error: "Session not found" };
      }

      if (!sessionRes.data.nodesById[nodeId]) {
        return { ok: false as const, error: "Unknown node id" };
      }

      const updated = {
        ...sessionRes.data,
        activeNodeId: nodeId,
        updatedAt: new Date().toISOString(),
      };

      await saveSession(JSON.stringify(updated));

      writer?.write({ type: "data-rabbit-hole-nav", data: { activeNodeId: nodeId }, transient: true });

      return { ok: true as const, activeNodeId: nodeId };
    },
  });

  const generate_rabbit_hole_node = tool({
    description:
      "Create one new rabbit-hole article node after user approval. Explain the proposal in chat first. At most once per assistant turn.",
    inputSchema: z.object({
      query: z.string().min(1),
      parentNodeId: z.string().uuid().optional(),
      label: z.string().max(80).optional(),
    }),
    execute: async ({ query, parentNodeId, label }, { toolCallId, messages }) => {
      const turnKey = messages[messages.length - 1];

      if (turnKey && nodeCreationAttemptedByMessage.get(turnKey)) {
        return { ok: false as const, error: "Only one node may be created per assistant turn." };
      }

      if (turnKey) {
        nodeCreationAttemptedByMessage.set(turnKey, true);
      }

      const sessionRes = await getSessionById(sessionId);

      if (sessionRes.error || !sessionRes.data) {
        return { ok: false as const, error: "Session not found" };
      }

      const session = sessionRes.data;
      const parent = parentNodeId ?? getActiveNodeId() ?? session.activeNodeId;
      const nodeId = crypto.randomUUID();

      const stubNode = {
        id: nodeId,
        rawPrompt: query,
        userQuestion: query,
        title: label ?? query.slice(0, 80),
        keyTakeaways: [],
        createdAt: new Date().toISOString(),
      };

      const updatedSession = {
        ...session,
        nodesById: { ...session.nodesById, [nodeId]: stubNode },
        path: [
          ...session.path,
          {
            nodeId,
            label: label ?? query.slice(0, 40),
            parentNodeId: parent,
          },
        ],
        generatingNodeId: nodeId,
        generationStep: "sources" as const,
      };

      await scheduleNodeGeneration({
        sessionId,
        nodeId,
        serializedSession: JSON.stringify(updatedSession),
      });

      logger.log("generate_rabbit_hole_node", "scheduled", { nodeId, toolCallId });

      return { ok: true as const, nodeId, sessionId };
    },
  });

  const search_rabbit_hole_context = tool({
    description: "Search rabbit hole session nodes for relevant context (scoped to session graph).",
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(12).optional().default(6),
    }),
    execute: async ({ query, limit }) => {
      const sessionRes = await getSessionById(sessionId);

      if (sessionRes.error || !sessionRes.data) {
        return { ok: false as const, results: [] as const };
      }

      const q = query.toLowerCase();
      const results = Object.values(sessionRes.data.nodesById)
        .filter((node) => {
          const hay = `${node.title ?? ""} ${node.userQuestion} ${node.summary ?? ""} ${(node.keyTakeaways ?? []).join(" ")}`.toLowerCase();

          return hay.includes(q);
        })
        .slice(0, limit)
        .map((node) => ({
          nodeId: node.id,
          title: node.title,
          snippet: (node.keyTakeaways ?? []).slice(0, 2).join(" · "),
        }));

      return { ok: true as const, results };
    },
  });

  return {
    navigate_rabbit_hole_node,
    generate_rabbit_hole_node,
    search_rabbit_hole_context,
  };
}
