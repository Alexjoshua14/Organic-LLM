import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  distillCandidateFromTurns,
  scoreIngestOutputDeterministic,
} from "@/lib/memory/ingest-quality";
import { recordMemoryEvent } from "@/lib/memory/quality-events";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import { MEMORY_INGEST_GOLDEN_CASES, getMemoryIngestGoldenCase } from "@/test-data/memory-ingest-golden";

export const maxDuration = 120;

const BodySchema = z.object({
  caseIds: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

type EvalCaseResult = {
  id: string;
  passed: boolean;
  charCount: number;
  missingFacts: string[];
  antiPatternHits: string[];
  probeHits?: number;
  probeTotal?: number;
};

export async function POST(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema> = {};

  try {
    const json = await req.json();

    body = BodySchema.parse(json);
  } catch {
    body = {};
  }

  const cases =
    body.caseIds?.length ?
      body.caseIds
        .map((id) => getMemoryIngestGoldenCase(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
    : MEMORY_INGEST_GOLDEN_CASES;

  const results: EvalCaseResult[] = [];

  for (const golden of cases) {
    const candidate = distillCandidateFromTurns(golden.turns);
    const score = scoreIngestOutputDeterministic(golden.id, candidate, golden);

    let probeHits = 0;
    let probeTotal = golden.probeQueries?.length ?? 0;

    if (!body.dryRun && probeTotal > 0 && golden.probeQueries) {
      for (const query of golden.probeQueries) {
        const search = await searchMemoriesForUser(admin.sbUserId, query, { limit: 5 });
        const hit = search.data?.results?.some((m) =>
          golden.expectedFacts.some((fact) =>
            m.memory.toLowerCase().includes(fact.toLowerCase())
          )
        );

        if (hit) probeHits += 1;
      }
    }

    results.push({
      id: golden.id,
      passed: score.passed,
      charCount: score.charCount,
      missingFacts: score.missingFacts,
      antiPatternHits: score.antiPatternHits,
      probeHits: probeTotal > 0 ? probeHits : undefined,
      probeTotal: probeTotal > 0 ? probeTotal : undefined,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const avgCharCount =
    results.reduce((sum, r) => sum + r.charCount, 0) / Math.max(1, results.length);

  await recordMemoryEvent({
    userId: admin.sbUserId,
    event: "eval_run",
    source: "eval",
    metadata: {
      dryRun: body.dryRun ?? false,
      total: results.length,
      passed,
      failed: results.length - passed,
      avgCharCount: Math.round(avgCharCount),
    },
  });

  return NextResponse.json({
    mode: body.dryRun ? "dry" : "live",
    total: results.length,
    passed,
    failed: results.length - passed,
    avgCharCount: Math.round(avgCharCount),
    at: new Date().toISOString(),
    results,
  });
}
