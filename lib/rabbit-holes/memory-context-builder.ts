import { generateText } from "ai";

import {
  RABBIT_HOLE_MEMORY_CONTEXT_MODEL,
  RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS,
  RABBIT_HOLE_MEMORY_SEARCH_LIMIT,
  RABBIT_HOLE_MEMORY_SYNTHESIS_CAP,
} from "@/lib/rabbit-holes/memory-context-models";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import {
  formatMemoriesForPrompt,
  selectMemoriesForPrompt,
} from "@/lib/memory/memory-relevance";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/rabbit-holes/memory-context-builder.ts");

const SYNTHESIS_SYSTEM = `You compress user memory snippets into a short personalization block for rabbit-hole article generation.
Output 3–6 tight bullets covering: who the user is (if known), likely interest in the topic, relevant preferences, and useful background.
Do not invent facts. If memories are thin, say what is uncertain. No preamble — bullets only. Max ~120 words.`;

export type RabbitHoleMemoryContextTimings = {
  memorySearchMs: number;
  llmSynthesisMs: number;
  totalMs: number;
};

export type BuildRabbitHoleMemoryContextResult = {
  contextBlock: string;
  timings: RabbitHoleMemoryContextTimings;
  memoryHitCount: number;
};

export type BuildRabbitHoleMemoryContextParams = {
  userId: string;
  topicQuery: string;
  pathHistory?: string;
  rootQuestion?: string;
};

export function warnIfRabbitHoleMemoryContextSlow(
  timings: RabbitHoleMemoryContextTimings,
  meta?: { sessionId?: string; nodeId?: string }
): void {
  if (timings.totalMs <= RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS) return;

  const breakdown = `memorySearch=${timings.memorySearchMs.toFixed(1)}ms, llmSynthesis=${timings.llmSynthesisMs.toFixed(1)}ms, total=${timings.totalMs.toFixed(1)}ms`;
  const warnLevel = RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS;
  const overBy = timings.totalMs - warnLevel;
  const message =
    `[rabbit-hole] Memory context builder exceeded ${warnLevel}ms hard warning threshold by ${overBy.toFixed(1)}ms (${breakdown})` +
    (meta?.sessionId ? ` sessionId=${meta.sessionId}` : "") +
    (meta?.nodeId ? ` nodeId=${meta.nodeId}` : "");

  logger.warn("buildRabbitHoleMemoryContextBlock", message);
  console.warn(message);
}

/**
 * Read-only Mem0 search + fast LLM synthesis for priming node generation prompts.
 */
export async function buildRabbitHoleMemoryContextBlock(
  params: BuildRabbitHoleMemoryContextParams,
  meta?: { sessionId?: string; nodeId?: string }
): Promise<BuildRabbitHoleMemoryContextResult> {
  const started = performance.now();
  let memorySearchMs = 0;
  let llmSynthesisMs = 0;

  const searchQuery = [
    params.topicQuery.trim(),
    params.rootQuestion?.trim(),
    params.pathHistory?.trim(),
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 500);

  const searchStarted = performance.now();
  const searchResult = await searchMemoriesForUser(params.userId, searchQuery, {
    limit: RABBIT_HOLE_MEMORY_SEARCH_LIMIT,
  });

  memorySearchMs = performance.now() - searchStarted;

  if (searchResult.error || !searchResult.data) {
    const timings: RabbitHoleMemoryContextTimings = {
      memorySearchMs,
      llmSynthesisMs: 0,
      totalMs: performance.now() - started,
    };

    warnIfRabbitHoleMemoryContextSlow(timings, meta);
    logger.warn(
      "buildRabbitHoleMemoryContextBlock",
      `Memory search failed: ${searchResult.error ?? "unknown"} (${timings.totalMs.toFixed(1)}ms)`
    );

    return { contextBlock: "", timings, memoryHitCount: 0 };
  }

  const hits = searchResult.data.results ?? [];
  const selected = selectMemoriesForPrompt(hits, {
    maxIncluded: RABBIT_HOLE_MEMORY_SYNTHESIS_CAP,
    minScore: 0.2,
  });

  if (selected.length === 0) {
    const timings: RabbitHoleMemoryContextTimings = {
      memorySearchMs,
      llmSynthesisMs: 0,
      totalMs: performance.now() - started,
    };

    warnIfRabbitHoleMemoryContextSlow(timings, meta);
    logger.log(
      "buildRabbitHoleMemoryContextBlock",
      `No memory hits (${timings.totalMs.toFixed(1)}ms search-only)`
    );

    return { contextBlock: "", timings, memoryHitCount: 0 };
  }

  const memoryBullets = formatMemoriesForPrompt(selected);
  const synthesisPrompt = [
    `Topic / node question: ${params.topicQuery.trim()}`,
    params.rootQuestion ? `Session root: ${params.rootQuestion.trim()}` : null,
    params.pathHistory ? `Exploration path: ${params.pathHistory.trim()}` : null,
    "",
    "Memory snippets:",
    memoryBullets,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const llmStarted = performance.now();

  const { text } = await generateText({
    model: RABBIT_HOLE_MEMORY_CONTEXT_MODEL,
    system: SYNTHESIS_SYSTEM,
    prompt: synthesisPrompt,
    maxOutputTokens: 220,
    temperature: 0.2,
  });

  llmSynthesisMs = performance.now() - llmStarted;

  const timings: RabbitHoleMemoryContextTimings = {
    memorySearchMs,
    llmSynthesisMs,
    totalMs: performance.now() - started,
  };

  warnIfRabbitHoleMemoryContextSlow(timings, meta);

  logger.log(
    "buildRabbitHoleMemoryContextBlock",
    `Built memory context block in ${timings.totalMs.toFixed(1)}ms (search=${memorySearchMs.toFixed(1)}ms, llm=${llmSynthesisMs.toFixed(1)}ms, hits=${selected.length})`
  );

  return {
    contextBlock: text.trim(),
    timings,
    memoryHitCount: selected.length,
  };
}
