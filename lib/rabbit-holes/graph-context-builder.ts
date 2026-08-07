import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import {
  collectBalancedRelatedNodeRefs,
  parentNodeIdForGeneration,
  type RelatedNodeRef,
} from "@/lib/rabbit-holes/collect-related-nodes";
import {
  RABBIT_HOLE_GRAPH_NODE_LIMIT,
  RABBIT_HOLE_GRAPH_RERANKED_LIMIT_DEFAULT,
} from "@/lib/rabbit-holes/graph-context-models";
import {
  ensureRabbitHoleNodeSummary,
  formatNodeSummaryDocument,
  nodeHasSummaryContent,
} from "@/lib/rabbit-holes/node-summary";
import { rerankDocuments } from "@/lib/rabbit-holes/rerank-document-chunks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/rabbit-holes/graph-context-builder.ts");

export type RabbitHoleGraphContextTimings = {
  collectMs: number;
  summaryBackfillMs: number;
  rerankMs: number;
  totalMs: number;
};

export type BuildRabbitHoleGraphContextResult = {
  contextBlock: string;
  timings: RabbitHoleGraphContextTimings;
  candidateCount: number;
  rerankedCount: number;
  /** Session nodes updated with newly generated summaries (caller should merge into session). */
  summaryUpdates: Record<string, string>;
};

export type BuildRabbitHoleGraphContextParams = {
  session: RabbitHoleSession;
  nodeId: string;
  topicQuery: string;
  /** Max parent+child nodes before rerank (default 100). */
  limit?: number;
  /** Max reranked summaries in the prompt (default 90). */
  rerankedLimit?: number;
};

function formatGraphContextSection(contextBlock: string): string {
  const trimmed = contextBlock.trim();

  if (!trimmed) return "";

  return (
    "Related rabbit hole articles (ranked by relevance to this topic):\n" + `${trimmed}\n\n`
  );
}

function roleLabel(role: RelatedNodeRef["role"]): string {
  return role === "ancestor" ? "ancestor" : "branch";
}

/**
 * Build ranked graph context from parent/child node summaries for article generation.
 */
export async function buildRabbitHoleGraphContextBlock(
  params: BuildRabbitHoleGraphContextParams
): Promise<BuildRabbitHoleGraphContextResult> {
  const started = performance.now();
  const limit = params.limit ?? RABBIT_HOLE_GRAPH_NODE_LIMIT;
  const rerankedLimit = params.rerankedLimit ?? RABBIT_HOLE_GRAPH_RERANKED_LIMIT_DEFAULT;

  const anchorNodeId = parentNodeIdForGeneration(params.session, params.nodeId);

  const collectStarted = performance.now();
  const refs = collectBalancedRelatedNodeRefs(params.session, {
    anchorNodeId,
    excludeNodeId: params.nodeId,
    limit,
  });
  const collectMs = performance.now() - collectStarted;

  const candidates = refs
    .map((ref) => ({ ref, node: params.session.nodesById[ref.nodeId] }))
    .filter((entry): entry is { ref: RelatedNodeRef; node: NonNullable<typeof entry.node> } =>
      Boolean(entry.node && nodeHasSummaryContent(entry.node))
    );

  if (candidates.length === 0) {
    const timings: RabbitHoleGraphContextTimings = {
      collectMs,
      summaryBackfillMs: 0,
      rerankMs: 0,
      totalMs: performance.now() - started,
    };

    logger.log(
      "buildRabbitHoleGraphContextBlock",
      `No related nodes with content (${timings.totalMs.toFixed(1)}ms)`
    );

    return {
      contextBlock: "",
      timings,
      candidateCount: 0,
      rerankedCount: 0,
      summaryUpdates: {},
    };
  }

  const summaryStarted = performance.now();
  const summaryUpdates: Record<string, string> = {};
  const documents: Array<{ text: string; meta: RelatedNodeRef }> = [];

  for (const { ref, node } of candidates) {
    const summary = await ensureRabbitHoleNodeSummary(node);

    if (!summary.trim()) continue;

    if (!node.summary?.trim()) {
      summaryUpdates[node.id] = summary;
    }

    const docNode = node.summary?.trim() ? node : { ...node, summary };
    const text = formatNodeSummaryDocument(docNode);

    documents.push({ text, meta: ref });
  }

  const summaryBackfillMs = performance.now() - summaryStarted;

  if (documents.length === 0) {
    const timings: RabbitHoleGraphContextTimings = {
      collectMs,
      summaryBackfillMs,
      rerankMs: 0,
      totalMs: performance.now() - started,
    };

    return {
      contextBlock: "",
      timings,
      candidateCount: candidates.length,
      rerankedCount: 0,
      summaryUpdates,
    };
  }

  const rerankStarted = performance.now();
  const ranked = await rerankDocuments({
    query: params.topicQuery.trim(),
    documents,
    topN: Math.min(rerankedLimit, documents.length),
  });
  const rerankMs = performance.now() - rerankStarted;

  const lines = ranked.map((row, rank) => {
    const role = roleLabel(row.meta.role);
    const nodeId = row.meta.nodeId;
    const node = params.session.nodesById[nodeId];
    const title = node?.title?.trim() || node?.userQuestion?.trim() || nodeId;
    const summary = summaryUpdates[nodeId] ?? node?.summary?.trim() ?? "";

    return `${rank + 1}. [${title}] (${role}, relevance=${row.score.toFixed(3)})\n${summary}`;
  });

  const contextBlock = formatGraphContextSection(lines.join("\n\n"));
  const timings: RabbitHoleGraphContextTimings = {
    collectMs,
    summaryBackfillMs,
    rerankMs,
    totalMs: performance.now() - started,
  };

  logger.log(
    "buildRabbitHoleGraphContextBlock",
    `Built graph context in ${timings.totalMs.toFixed(1)}ms (collect=${collectMs.toFixed(1)}ms, summaries=${summaryBackfillMs.toFixed(1)}ms, rerank=${rerankMs.toFixed(1)}ms, candidates=${candidates.length}, reranked=${ranked.length})`
  );

  return {
    contextBlock,
    timings,
    candidateCount: candidates.length,
    rerankedCount: ranked.length,
    summaryUpdates,
  };
}

/** Exported for prompt injection in actions.ts */
export function formatGraphContextForPrompt(graphContext?: string): string {
  const trimmed = graphContext?.trim();

  if (!trimmed) return "";

  if (trimmed.startsWith("Related rabbit hole articles")) return `${trimmed}\n\n`;

  return formatGraphContextSection(trimmed);
}
