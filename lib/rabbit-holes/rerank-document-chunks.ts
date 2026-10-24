import { createLogger } from "@/lib/logger";
import { RABBIT_HOLE_GRAPH_RERANK_MODEL } from "@/lib/rabbit-holes/graph-context-models";

const logger = createLogger("lib/rabbit-holes/rerank-document-chunks.ts");

export type RankedDocument<TMeta = unknown> = {
  index: number;
  score: number;
  meta: TMeta;
};

export type RerankDocumentsOptions<TMeta> = {
  query: string;
  documents: Array<{ text: string; meta: TMeta }>;
  topN: number;
};

type CohereRerankResponse = {
  results?: Array<{ index: number; relevance_score: number }>;
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

/** Lexical overlap fallback when Cohere rerank is unavailable (tests / missing API key). */
export function rerankDocumentsLexical<TMeta>(
  options: RerankDocumentsOptions<TMeta>
): RankedDocument<TMeta>[] {
  const queryTokens = tokenize(options.query);

  const scored = options.documents.map((doc, index) => {
    const docTokens = tokenize(doc.text);
    let overlap = 0;

    for (const token of queryTokens) {
      if (docTokens.has(token)) overlap += 1;
    }

    const score = queryTokens.size > 0 ? overlap / queryTokens.size : 0;

    return { index, score, meta: doc.meta };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, Math.max(0, options.topN));
}

async function rerankDocumentsCohere<TMeta>(
  options: RerankDocumentsOptions<TMeta>
): Promise<RankedDocument<TMeta>[]> {
  const apiKey = process.env.COHERE_API_KEY?.trim();

  if (!apiKey) return rerankDocumentsLexical(options);

  const res = await fetch("https://api.cohere.ai/v1/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: RABBIT_HOLE_GRAPH_RERANK_MODEL,
      query: options.query,
      documents: options.documents.map((d) => d.text),
      top_n: Math.min(options.topN, options.documents.length),
      return_documents: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");

    logger.warn(
      "rerankDocumentsCohere",
      `Cohere rerank failed (${res.status}): ${body.slice(0, 200)} — using lexical fallback`
    );

    return rerankDocumentsLexical(options);
  }

  const data = (await res.json()) as CohereRerankResponse;
  const results = data.results ?? [];

  return results.map((row) => ({
    index: row.index,
    score: row.relevance_score,
    meta: options.documents[row.index]!.meta,
  }));
}

/**
 * Rerank document strings by relevance to `query`. Uses Cohere when configured, else lexical overlap.
 */
export async function rerankDocuments<TMeta>(
  options: RerankDocumentsOptions<TMeta>
): Promise<RankedDocument<TMeta>[]> {
  if (options.documents.length === 0 || options.topN <= 0) return [];

  if (options.documents.length <= options.topN) {
    return rerankDocumentsCohere(options);
  }

  return rerankDocumentsCohere(options);
}
