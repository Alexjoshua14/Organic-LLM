import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";

/**
 * Pure draft of a session with one new node appended (and generating). Shared by the in-session
 * assistant tools and the rabbit hole toolset; lives apart from them so it loads without the
 * data layer.
 */
export function draftGeneratedRabbitHoleNode({
  session,
  query,
  label,
  parentNodeId,
  activeNodeId,
  nodeId = crypto.randomUUID(),
  now = new Date().toISOString(),
}: {
  session: RabbitHoleSession;
  query: string;
  label?: string;
  parentNodeId?: string;
  activeNodeId: string | null;
  nodeId?: string;
  now?: string;
}): { session: RabbitHoleSession; nodeId: string; title: string } {
  const parent = parentNodeId ?? activeNodeId ?? session.activeNodeId;
  const rawTitle = (label ?? query).trim();
  const title = (rawTitle.length >= 4 ? rawTitle : `${rawTitle} node`).slice(0, 80);
  const isFirstNode = !session.rootNodeId && session.path.length === 0;
  const existingEdges = session.edges ?? [];
  const edges =
    parent && !existingEdges.some((edge) => edge.from === parent && edge.to === nodeId)
      ? [...existingEdges, { from: parent, to: nodeId }]
      : existingEdges;
  const existingRoot = session.rootQuestion?.trim() ?? "";
  const rootQuestion =
    !existingRoot || existingRoot === RABBIT_HOLE_UNTITLED ? title : session.rootQuestion;

  const updatedSession: RabbitHoleSession = {
    ...session,
    rootQuestion,
    rootNodeId: isFirstNode ? nodeId : session.rootNodeId,
    activeNodeId: nodeId,
    updatedAt: now,
    nodesById: {
      ...session.nodesById,
      [nodeId]: {
        id: nodeId,
        rawPrompt: query,
        userQuestion: query,
        title,
        branchSuggestions: [],
        keyTakeaways: [],
        createdAt: now,
      },
    },
    path: [
      ...session.path,
      {
        nodeId,
        label: label ?? query.slice(0, 40),
        parentNodeId: parent,
      },
    ],
    edges,
    generatingNodeId: nodeId,
    generationStep: "sources",
  };

  return { session: updatedSession, nodeId, title };
}
