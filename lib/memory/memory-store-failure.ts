import { OLLAMA_EMBED_MODEL, OLLAMA_URL, isLocalOllamaUrl } from "./ollama-config";

export type MemoryStoreFailureKind = "embedder" | "qdrant" | "sqlite" | "mem0_llm" | "unknown";

export type MemoryStoreFailureDiagnosis = {
  kind: MemoryStoreFailureKind;
  /** Operator-facing hint for server logs (grep for `Memory store call failed [`). */
  hint: string;
  detail?: string;
};

function errorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts: string[] = [error.message];
  let cause: unknown = error.cause;

  while (cause instanceof Error) {
    parts.push(cause.message);
    cause = cause.cause;
  }

  return parts.join(" | ");
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Classifies Mem0 / memory-store failures so server logs point at the right dependency
 * (Ollama embedder vs Qdrant vs local sqlite history vs OpenAI fact extraction).
 */
export function diagnoseMemoryStoreFailure(error: unknown): MemoryStoreFailureDiagnosis {
  const text = errorText(error);
  const lower = text.toLowerCase();

  if (
    matchesAny(lower, [
      /better-sqlite3/,
      /could not locate the bindings file/,
      /node_sqlite3/,
    ])
  ) {
    return {
      kind: "sqlite",
      hint:
        "Mem0 local history DB (better-sqlite3) failed — run `npm rebuild better-sqlite3` and ensure Next.js externalizes native modules (better-sqlite3, mem0ai).",
      detail: text,
    };
  }

  if (
    matchesAny(lower, [
      /qdrant/,
      /memory_api/,
      /memory-api/,
      /unauthorized/,
      /forbidden/,
      /collection.*not found/,
      /wrong input/,
    ]) &&
    !matchesAny(lower, [/ollama embed/, /mem0 ollama embedder/])
  ) {
    return {
      kind: "qdrant",
      hint:
        "Memory vector store (Qdrant) failed — verify MEMORY_API_HOST, MEMORY_API_PORT, MEMORY_API_SECRET, and that the memories_v2 collection exists.",
      detail: text,
    };
  }

  if (
    matchesAny(lower, [
      /mem0 ollama embedder/,
      /ollama embed failed/,
      /ollama list models failed/,
      /ollama pull failed/,
      /ollama batch embed/,
      /ensuring model exists/,
      /embedding dimension/,
      /dimension probe/,
      /\/api\/embed/,
      /nomic-embed/,
    ]) ||
    (lower.includes("fetch failed") &&
      matchesAny(lower, [/ollama/, /11434/, /embed/, /ensuring model exists/]))
  ) {
    const remote = !isLocalOllamaUrl();
    const authHint = remote
      ? "Set OLLAMA_API_KEY for remote Ollama proxies."
      : "Ensure Ollama is running locally and the embed model is pulled.";

    return {
      kind: "embedder",
      hint: `Mem0 Ollama embedder unreachable — verify OLLAMA_URL (${OLLAMA_URL}), OLLAMA_EMBED_MODEL (${OLLAMA_EMBED_MODEL}), and ${authHint}`,
      detail: text,
    };
  }

  if (
    matchesAny(lower, [
      /openai/,
      /invalid api key/,
      /incorrect api key/,
      /fact extraction/,
      /customprompt/,
    ])
  ) {
    return {
      kind: "mem0_llm",
      hint: "Mem0 fact-extraction LLM failed — verify OPENAI_API_KEY and that gpt-5.4-nano (mem0-config) is available.",
      detail: text,
    };
  }

  return {
    kind: "unknown",
    hint:
      "Memory store call failed — check server logs for embedder (OLLAMA_*), Qdrant (MEMORY_API_*), sqlite (better-sqlite3), and OpenAI (OPENAI_API_KEY).",
    detail: text,
  };
}
