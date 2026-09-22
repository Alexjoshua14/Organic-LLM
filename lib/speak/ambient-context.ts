import "server-only";

import type { RabbitHoleNode, RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import type { SpeakScreenSurface } from "@/lib/schemas/speak-screen-context";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import { getSessionById, getRabbitHoleSessionOwnerId } from "@/data/supabase/rabbitholes";
import { getConversationSummary, getThreadOwnerContext } from "@/data/supabase/chat";
import { getStrataPageById } from "@/data/supabase/strata";
import { createLogger } from "@/lib/logger";
import { AMBIENT_CLEARED_BODY } from "@/lib/speak/ambient-item";
import { estimateSpeakTokens } from "@/lib/speak/token-limit";

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
const NODE_SUMMARY_MAX_CHARS = 420;

/** Graph shape only needs enough nodes to answer "where am I"; deep holes are summarized. */
const RABBIT_HOLE_MAX_NODES = 12;

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
  return node.title?.trim() || node.userQuestion?.trim() || "Untitled";
}

/**
 * Both halves the voice agent needs: the *shape* of the exploration (which question led to
 * which) and a one-line gist per node. Edges are rendered as `parent → child` lines rather than
 * an adjacency dump so the model reads the branching without any parsing.
 */
export function buildRabbitHoleSections(
  session: RabbitHoleSession,
  activeNodeId: string | null
): string[] {
  const nodes = Object.values(session.nodesById).slice(0, RABBIT_HOLE_MAX_NODES);
  const truncated = Object.keys(session.nodesById).length - nodes.length;
  const active = activeNodeId ? session.nodesById[activeNodeId] : null;

  const header = active
    ? `The user is reading the rabbit hole "${session.rootQuestion}", currently on the node "${nodeLabel(active)}".`
    : `The user has the rabbit hole "${session.rootQuestion}" open.`;

  const edges = (session.edges ?? [])
    .map((e) => {
      const from = session.nodesById[e.from];
      const to = session.nodesById[e.to];

      return from && to ? `- ${nodeLabel(from)} → ${nodeLabel(to)}` : null;
    })
    .filter((line): line is string => line !== null);

  const summaries = nodes
    .map((node) => {
      const gist = node.summary?.trim() || node.keyTakeaways?.join("; ") || node.preview?.trim();

      return gist ? `- ${nodeLabel(node)}: ${clip(gist, NODE_SUMMARY_MAX_CHARS)}` : null;
    })
    .filter((line): line is string => line !== null);

  return [
    header,
    edges.length > 0 ? `How the exploration branches:\n${edges.join("\n")}` : "",
    summaries.length > 0
      ? `What each node covers:\n${summaries.join("\n")}${
          truncated > 0 ? `\n(…and ${truncated} more node${truncated === 1 ? "" : "s"})` : ""
        }`
      : "",
  ];
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
