import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";
import type { RabbitHoleNodeSearchRow } from "@/data/supabase/rabbitholes";

import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";

/**
 * Keyword search over a user's rabbit holes: session titles and questions, plus node titles,
 * questions, key takeaways and summaries. Never touches article bodies. Semantic search is
 * tracked separately; this keeps the same input and output shape so callers don't change.
 */

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "about",
  "is",
  "are",
  "how",
  "what",
  "my",
]);

const FIELD_WEIGHT = { title: 3, question: 2, takeaways: 1.5, summary: 1 } as const;
const DISTINCT_TERM_WEIGHT = 10;
const TOP_NODE_MATCHES = 3;

export function tokenizeSearchQuery(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}_+#]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  return [...new Set(terms)];
}

type Scored = { score: number; terms: Set<string> };

function scoreFields(terms: string[], fields: Array<[string, number]>): Scored {
  const matched = new Set<string>();
  let score = 0;

  for (const term of terms) {
    let best = 0;

    for (const [text, weight] of fields) {
      if (weight > best && text.toLowerCase().includes(term)) best = weight;
    }

    if (best > 0) {
      matched.add(term);
      score += best;
    }
  }

  return { score, terms: matched };
}

export type RabbitHoleSearchHit = {
  sessionId: string;
  title: string;
  description: string;
  updatedAt: string;
  nodeCount: number;
  matchedTerms: string[];
  matchingNodes: Array<{ nodeId: string; title: string; matchedTerms: string[] }>;
};

export function searchRabbitHoles({
  query,
  sessions,
  nodeRows,
  limit,
}: {
  query: string;
  sessions: RabbitHoleSessionMetadata[];
  nodeRows: RabbitHoleNodeSearchRow[];
  limit: number;
}): RabbitHoleSearchHit[] {
  const terms = tokenizeSearchQuery(query);

  if (terms.length === 0) return [];

  const rowsBySession = new Map<string, RabbitHoleNodeSearchRow[]>();

  for (const row of nodeRows) {
    const rows = rowsBySession.get(row.sessionId) ?? [];

    rows.push(row);
    rowsBySession.set(row.sessionId, rows);
  }

  const ranked: Array<{ hit: RabbitHoleSearchHit; rank: number }> = [];

  for (const session of sessions) {
    const sessionTitle = session.rootTitle?.trim() || session.rootQuestion.trim();
    const own = scoreFields(terms, [
      [sessionTitle, FIELD_WEIGHT.title],
      [session.rootQuestion, FIELD_WEIGHT.question],
      [session.summary ?? "", FIELD_WEIGHT.summary],
    ]);

    const nodes = (rowsBySession.get(session.sessionId) ?? [])
      .map((row) => ({
        row,
        ...scoreFields(terms, [
          [row.title ?? "", FIELD_WEIGHT.title],
          [row.userQuestion, FIELD_WEIGHT.question],
          [row.keyTakeaways.join(" "), FIELD_WEIGHT.takeaways],
          [row.summary ?? "", FIELD_WEIGHT.summary],
        ]),
      }))
      .filter((n) => n.score > 0)
      .sort((a, b) => b.score - a.score);

    const matchedTerms = new Set([...own.terms, ...nodes.flatMap((n) => [...n.terms])]);

    if (matchedTerms.size === 0) continue;

    const topNodes = nodes.slice(0, TOP_NODE_MATCHES);
    const rank =
      matchedTerms.size * DISTINCT_TERM_WEIGHT +
      own.score +
      topNodes.reduce((sum, n) => sum + n.score, 0);

    ranked.push({
      rank,
      hit: {
        sessionId: session.sessionId,
        title: sessionTitle || RABBIT_HOLE_UNTITLED,
        description: session.summary ?? session.rootQuestion,
        updatedAt: session.updatedAt,
        nodeCount: session.pathLength,
        matchedTerms: [...matchedTerms],
        matchingNodes: topNodes.map((n) => ({
          nodeId: n.row.nodeId,
          title: n.row.title ?? n.row.userQuestion.slice(0, 80),
          matchedTerms: [...n.terms],
        })),
      },
    });
  }

  return ranked
    .sort((a, b) => b.rank - a.rank || b.hit.updatedAt.localeCompare(a.hit.updatedAt))
    .slice(0, limit)
    .map((r) => r.hit);
}
