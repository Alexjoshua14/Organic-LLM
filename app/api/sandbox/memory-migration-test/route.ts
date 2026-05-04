import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { enrichMigrationCompareRows } from "@/lib/memory/migration-test-enrich-rows";
import {
  generateMigrationTestSynopsis,
} from "@/lib/memory/migration-test-synopsis-llm";
import type { MemoryMigrationTestRun } from "@/lib/memory/memory-migration-test-types";
import { buildMigrationCompareRows } from "@/lib/memory/migration-compare-rows";
import { embedLegacyQueryForMarginalSearch } from "@/lib/memory/search-memories-legacy-qdrant";
import { searchMemoriesV2FromQdrant } from "@/lib/memory/search-memories-v2-qdrant";
import { getAllMemories, searchMemories } from "@/lib/memory/store";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { checkMemoryListLimit, checkMemorySearchLimit } from "@/lib/rate-limit/memory";
import { SearchResult as SearchResultSchema, type SearchResultType } from "@/lib/schemas/memory";

export const maxDuration = 120;

const logger = createLogger("app/api/sandbox/memory-migration-test/route.ts");

const BodySchema = z.object({
  queryCount: z.union([z.literal(5), z.literal(10), z.literal(20)]),
});

/** Same top-k as typical chat context (`getContext` uses 5). */
const RETRIEVAL_LIMIT = 5;

/**
 * When the user has fewer stored memories than `queryCount`, pad with fixed probes so we
 * still run N searches (semantic stress on both collections).
 */
const PAD_QUERIES: string[] = [
  "preferences, habits, and things I like",
  "work projects, stack, and tools I use",
  "people, places, and recurring plans",
  "learning goals and technical interests",
  "health, routines, and constraints",
  "short-term tasks and reminders",
  "long-term goals and values",
  "recent context and open threads",
];

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

function pickQueries(corpus: string[], count: number): string[] {
  const unique = [...new Set(corpus.map((s) => s.trim()).filter(Boolean))];
  shuffleInPlace(unique);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < unique.length) {
      out.push(unique[i]!);
    } else {
      out.push(PAD_QUERIES[(i - unique.length) % PAD_QUERIES.length]!);
    }
  }
  return out;
}

type SearchParseOutcome =
  | { ok: true; data: SearchResultType }
  | { ok: false; error: string };

function validateSearch(result: unknown): SearchParseOutcome {
  const parsed = SearchResultSchema.safeParse(result);
  if (!parsed.success) {
    return { ok: false, error: "Invalid memory response" };
  }
  return { ok: true, data: parsed.data };
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { queryCount } = parsed.data;

  const clerkUser = await auth();
  if (!clerkUser?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

  const listLimit = await checkMemoryListLimit(sbUserId);
  if (!listLimit.success) {
    return Response.json({ error: listLimit.error ?? "Too many requests" }, { status: 429 });
  }

  let all: SearchResultType;
  try {
    const raw = await getAllMemories(sbUserId);
    const v = validateSearch(raw);
    if (!v.ok) {
      return Response.json({ error: v.error }, { status: 502 });
    }
    all = v.data;
  } catch (err) {
    logger.warn("POST", "getAllMemories failed", err);
    return Response.json({ error: "Memory service may be unavailable." }, { status: 503 });
  }

  const corpus = (all.results ?? []).map((m) => m.memory);
  const queries = pickQueries(corpus, queryCount);

  const runs: MemoryMigrationTestRun[] = [];

  for (const query of queries) {
    const limitResLegacy = await checkMemorySearchLimit(sbUserId);
    if (!limitResLegacy.success) {
      return Response.json(
        { error: limitResLegacy.error ?? "Too many requests", runs },
        { status: 429 }
      );
    }
    const limitResV2 = await checkMemorySearchLimit(sbUserId);
    if (!limitResV2.success) {
      return Response.json(
        { error: limitResV2.error ?? "Too many requests", runs },
        { status: 429 }
      );
    }

    let legacy: SearchResultType = { results: [], relations: [] };
    try {
      const rawLegacy = await searchMemories(query, sbUserId, { limit: RETRIEVAL_LIMIT });
      const v = validateSearch(rawLegacy);
      legacy = v.ok ? v.data : { results: [], relations: [] };
      if (!v.ok) {
        logger.warn("POST", "legacy search schema invalid", query);
      }
    } catch (err) {
      logger.warn("POST", "legacy search failed", err);
      return Response.json(
        { error: "Legacy memory search failed.", runs },
        { status: 503 }
      );
    }

    let v2: SearchResultType = { results: [], relations: [] };
    let v2Error: string | undefined;
    let v2QueryVector: number[] = [];
    try {
      const rawV2 = await searchMemoriesV2FromQdrant(query, sbUserId, RETRIEVAL_LIMIT);
      v2QueryVector = rawV2.queryVector;
      const v = validateSearch({ results: rawV2.results, relations: [] });
      v2 = v.ok ? v.data : { results: [], relations: [] };
      if (!v.ok) {
        v2Error = "Invalid v2 memory response shape";
      }
    } catch (err) {
      v2Error = err instanceof Error ? err.message : "V2 search failed";
      logger.warn("POST", `v2 search failed: ${v2Error}`, err);
    }

    let legacyQueryVector: number[] = [];
    try {
      legacyQueryVector = await embedLegacyQueryForMarginalSearch(query);
    } catch (err) {
      logger.warn("POST", "legacy embed for marginal failed", err);
    }

    const baseRows = buildMigrationCompareRows(legacy.results ?? [], v2.results ?? []);
    const rows = await enrichMigrationCompareRows(
      baseRows,
      legacy.results ?? [],
      v2.results ?? [],
      sbUserId,
      legacyQueryVector,
      v2QueryVector,
      v2Error
    );

    runs.push({
      query,
      legacy,
      v2,
      rows,
      ...(v2Error ? { v2Error } : {}),
    });
  }

  const llmLimit = await checkLlmMessageLimit(sbUserId);
  let synopsis: string | null = null;
  let synopsisError: string | undefined;
  let synopsisSkippedReason: string | null = null;

  if (!llmLimit.success) {
    synopsisSkippedReason = llmLimit.error ?? "LLM rate limit";
  } else {
    try {
      synopsis = await generateMigrationTestSynopsis(runs);
    } catch (err) {
      synopsisError = err instanceof Error ? err.message : "Synopsis generation failed";
      logger.warn("POST", "synopsis failed", err);
    }
  }

  return Response.json({
    runs,
    synopsis,
    ...(synopsisError ? { synopsisError } : {}),
    ...(synopsisSkippedReason ? { synopsisSkippedReason } : {}),
  });
}
