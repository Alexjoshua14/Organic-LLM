/**
 * Arcadia user-memory compilation: typed planner (or raw query), Mem0 search,
 * optional standing portrait, under a wall-clock deadline.
 *
 * When {@link RunArcadiaMemoryPhaseParams.contextEffort} is omitted, callers
 * should use the legacy rewriter in `getContext` instead of this module.
 */
import type { UIMessage } from "ai";
import type { MemoryItemType } from "@/lib/schemas/memory";

import { getProfileTreeByProfileId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { compactProfileTree, trimMemoryPackToTokenCap } from "@/lib/memory/compact-profile";
import {
  type ContextEffortBudget,
  type ContextEffortLevel,
  getContextEffortBudget,
} from "@/lib/memory/context-effort";
import { searchMemoriesWithL1Cache } from "@/lib/memory/memory-search-cache";
import {
  ARCADIA_MEMORY_MIN_SCORE,
  bucketMemoriesByTier,
  buildArcadiaMemoryInventoryText,
  formatMemoriesForPrompt,
  selectMemoriesForPrompt,
} from "@/lib/memory/memory-relevance";
import {
  type MemoryPlanSlots,
  planMemoryQueries,
  secondPassQuery,
} from "@/lib/memory/query-planner";
import { mergeMemorySearchResultsByMaxScore } from "@/lib/memory/query-rewriter";
import {
  classifyRateLimitError,
  logBatchedRateLimitHits,
  peekRateLimitHitBatch,
  runWithRateLimitHitBatch,
  type RateLimitHit,
} from "@/lib/rate-limit/hit-batch";

const logger = createLogger("lib/memory/arcadia-memory-phase.ts");

export type RunArcadiaMemoryPhaseParams = {
  sbUserId: string;
  userMessage: string;
  recentTurns: UIMessage[];
  conversationMessagesInContext: number;
  contextEffort: ContextEffortLevel;
  /**
   * Test seam for the retrieval planner, mirroring `planMemoryQueries`'s own
   * `generateTextImpl`. Tests inject here instead of mocking the planner module, which
   * Bun applies process-wide and which would then leak into the planner's own tests.
   */
  planner?: {
    planMemoryQueries?: typeof planMemoryQueries;
    secondPassQuery?: typeof secondPassQuery;
  };
};

export type ArcadiaMemoryPhaseResult = {
  selected: MemoryItemType[];
  sampleItems: MemoryItemType[];
  memoriesText: string;
  portraitText: string;
  inventoryText: string;
  queryRewriteUsed: boolean;
  effectiveQueryCount: number;
  overfetchCap: number;
  injectCap: number;
  timedOut: boolean;
};

type SearchAttempt = {
  queryLength: number;
  cacheHit: boolean;
  resultCount: number;
  elapsedMs: number;
  error?: string;
};

type PhaseAccumulator = {
  items: MemoryItemType[];
  portraitText: string;
  queries: string[];
  usedPlan: boolean;
  slots: MemoryPlanSlots;
  searches: SearchAttempt[];
};

export async function raceWithDeadline<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<{ value: T; timedOut: boolean }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      resolve(fallback);
    }, ms);
  });

  try {
    const value = await Promise.race([promise, timeout]);

    return { value, timedOut };
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function loadPortrait(sbUserId: string, budget: ContextEffortBudget): Promise<string> {
  if (!budget.includeProfile) return "";

  try {
    const result = await getProfileTreeByProfileId(sbUserId);

    if (result.error || !result.data?.tree) return "";

    return compactProfileTree(result.data.tree, {
      maxSections: budget.profileMaxSections,
      rich: budget.profileRich,
      tokenCap: budget.profileTokenCap,
    });
  } catch (error) {
    logger.warn("loadPortrait", "Failed to load profile tree", {
      error: error instanceof Error ? error.message : String(error),
    });

    return "";
  }
}

async function searchQuery(
  sbUserId: string,
  query: string,
  overfetch: number,
  acc: PhaseAccumulator
): Promise<MemoryItemType[]> {
  const run = await searchMemoriesWithL1Cache(sbUserId, query, overfetch);
  const error = run.result.error ?? undefined;

  acc.searches.push({
    queryLength: query.length,
    cacheHit: run.metrics.cacheHit,
    resultCount: run.result.data?.results?.length ?? 0,
    elapsedMs: run.metrics.memorySearchMs,
    error,
  });

  return error ? [] : (run.result.data?.results ?? []);
}

async function runPhaseWork(
  params: RunArcadiaMemoryPhaseParams,
  budget: ContextEffortBudget,
  acc: PhaseAccumulator,
  startedAt: number
): Promise<void> {
  const { sbUserId, userMessage, recentTurns } = params;
  const portraitPromise = loadPortrait(sbUserId, budget).then((text) => {
    acc.portraitText = text;

    return text;
  });

  const trimmed = userMessage.trim();

  if (budget.plannerTimeoutMs === null) {
    if (trimmed) {
      acc.queries = [trimmed];
      acc.items = await searchQuery(sbUserId, trimmed, budget.overfetch, acc);
    }
    await portraitPromise;

    return;
  }

  if (!trimmed) {
    await portraitPromise;

    return;
  }

  const plan = await (params.planner?.planMemoryQueries ?? planMemoryQueries)(
    trimmed,
    recentTurns,
    { timeoutMs: budget.plannerTimeoutMs }
  );

  acc.usedPlan = plan.usedPlan;
  acc.slots = plan.slots;
  acc.queries = plan.queries;

  if (plan.queries.length > 0) {
    const batches = await Promise.all(
      plan.queries.map((q) => searchQuery(sbUserId, q, budget.overfetch, acc))
    );

    acc.items = mergeMemorySearchResultsByMaxScore(batches);
  }

  const remaining = budget.budgetMs - (performance.now() - startedAt);

  if (budget.secondPassMinRemainingMs > 0 && remaining > budget.secondPassMinRemainingMs) {
    const extra = (params.planner?.secondPassQuery ?? secondPassQuery)(acc.slots, trimmed);

    if (extra && !acc.queries.some((q) => q.toLowerCase() === extra.toLowerCase())) {
      const extraItems = await searchQuery(sbUserId, extra, budget.overfetch, acc);

      acc.items = mergeMemorySearchResultsByMaxScore([acc.items, extraItems]);
      acc.queries = [...acc.queries, extra];
    }
  }

  await portraitPromise;
}

function searchOutcome(acc: PhaseAccumulator, effort: ContextEffortLevel) {
  const attempted = acc.searches.length;
  const cacheHits = acc.searches.filter((search) => search.cacheHit).length;
  const errors = acc.searches.filter((search) => search.error).length;
  const mem0Ok = acc.searches.filter((search) => !search.error && !search.cacheHit).length;

  return {
    attempted,
    cacheHits,
    mem0Ok,
    errors,
    expectedUncachedMax: effort === "instant" ? 1 : effort === "heavy" ? 4 : 3,
  };
}

function rateLimitHitsFromSearchErrors(searches: SearchAttempt[]): RateLimitHit[] {
  const hits: RateLimitHit[] = [];

  for (const search of searches) {
    if (!search.error) continue;
    const catalog = classifyRateLimitError(search.error);

    if (!catalog) continue;

    hits.push({
      limiter: catalog.id,
      prefix: catalog.prefix,
      cap: catalog.cap,
      window: catalog.window,
      error: search.error,
      where: "arcadiaMemoryPhase.search",
    });
  }

  return hits;
}

export async function runArcadiaMemoryPhase(
  params: RunArcadiaMemoryPhaseParams
): Promise<ArcadiaMemoryPhaseResult> {
  const { value } = await runWithRateLimitHitBatch(() => runArcadiaMemoryPhaseWork(params));

  return value;
}

async function runArcadiaMemoryPhaseWork(
  params: RunArcadiaMemoryPhaseParams
): Promise<ArcadiaMemoryPhaseResult> {
  const budget = getContextEffortBudget(params.contextEffort);
  const startedAt = performance.now();
  const acc: PhaseAccumulator = {
    items: [],
    portraitText: "",
    queries: [],
    usedPlan: false,
    slots: {},
    searches: [],
  };

  const work = runPhaseWork(params, budget, acc, startedAt).catch((error) => {
    logger.warn("runArcadiaMemoryPhase", "Phase work failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const { timedOut } = await raceWithDeadline(work, budget.budgetMs, undefined);

  const sampleItems = acc.items.slice();
  const selectedRaw = selectMemoriesForPrompt(sampleItems, {
    maxIncluded: budget.injectCap,
    minScore: ARCADIA_MEMORY_MIN_SCORE,
  });
  const trimmed = trimMemoryPackToTokenCap({
    portraitText: acc.portraitText,
    memories: selectedRaw,
    tokenCap: budget.combinedTokenCap,
  });
  const tiers = bucketMemoriesByTier(sampleItems, ARCADIA_MEMORY_MIN_SCORE);
  const inventoryText = buildArcadiaMemoryInventoryText({
    conversationMessagesInContext: params.conversationMessagesInContext,
    memoriesInjected: trimmed.memories.length,
    tiers,
    overfetchCap: budget.overfetch,
    minScore: ARCADIA_MEMORY_MIN_SCORE,
    queryRewriteUsed: acc.usedPlan,
    effectiveQueryCount: acc.queries.length || 1,
    injectCap: budget.injectCap,
    contextEffort: params.contextEffort,
  });

  const searches = searchOutcome(acc, params.contextEffort);
  const elapsedMs = performance.now() - startedAt;
  const alsHits = peekRateLimitHitBatch();
  const rateLimitHits = alsHits.length > 0 ? alsHits : rateLimitHitsFromSearchErrors(acc.searches);

  logger.log("runArcadiaMemoryPhase", "complete", {
    effort: params.contextEffort,
    timedOut,
    elapsedMs,
    queryCount: acc.queries.length,
    usedPlan: acc.usedPlan,
    sampleCount: sampleItems.length,
    injected: trimmed.memories.length,
    hasPortrait: Boolean(trimmed.portraitText),
    searches,
    rateLimitDenies: rateLimitHits.length,
  });

  logBatchedRateLimitHits(
    "runArcadiaMemoryPhase",
    "Rate limits denied during context-effort memory compilation",
    {
      effort: params.contextEffort,
      timedOut,
      elapsedMs,
      searches,
    },
    rateLimitHits
  );

  return {
    selected: trimmed.memories,
    sampleItems,
    memoriesText: trimmed.memoriesText || formatMemoriesForPrompt(trimmed.memories),
    portraitText: trimmed.portraitText,
    inventoryText,
    queryRewriteUsed: acc.usedPlan,
    effectiveQueryCount: acc.queries.length || (params.userMessage.trim() ? 1 : 0),
    overfetchCap: budget.overfetch,
    injectCap: budget.injectCap,
    timedOut,
  };
}
