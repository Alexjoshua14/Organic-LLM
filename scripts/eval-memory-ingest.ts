#!/usr/bin/env npx tsx
/**
 * Offline memory ingest eval — deterministic by default (CI-safe).
 * Usage:
 *   npx tsx scripts/eval-memory-ingest.ts
 *   npx tsx scripts/eval-memory-ingest.ts --live
 */

import {
  distillCandidateFromTurns,
  scoreIngestOutputDeterministic,
} from "../lib/memory/ingest-quality";
import { MEMORY_INGEST_GOLDEN_CASES } from "../test-data/memory-ingest-golden";

const live = process.argv.includes("--live");

type CaseResult = {
  id: string;
  passed: boolean;
  charCount: number;
  missingFacts: string[];
  antiPatternHits: string[];
  classifier?: { decision: string; reason?: string };
};

async function runCase(caseId: string, live: boolean): Promise<CaseResult> {
  const golden = MEMORY_INGEST_GOLDEN_CASES.find((c) => c.id === caseId);

  if (!golden) {
    throw new Error(`Unknown case: ${caseId}`);
  }

  const candidate = distillCandidateFromTurns(golden.turns);
  const score = scoreIngestOutputDeterministic(golden.id, candidate, golden);

  let classifier: CaseResult["classifier"];

  if (live && candidate) {
    const { classifyMemoryQuality } = await import("../lib/memory/ingest-quality-llm");
    const result = await classifyMemoryQuality(candidate);

    classifier = { decision: result.decision, reason: result.reason };
  }

  return {
    id: golden.id,
    passed: score.passed,
    charCount: score.charCount,
    missingFacts: score.missingFacts,
    antiPatternHits: score.antiPatternHits,
    classifier,
  };
}

async function main() {
  const results: CaseResult[] = [];

  for (const c of MEMORY_INGEST_GOLDEN_CASES) {
    results.push(await runCase(c.id, live));
  }

  const passed = results.filter((r) => r.passed).length;
  const avgChars =
    results.reduce((sum, r) => sum + r.charCount, 0) / Math.max(1, results.length);

  const report = {
    mode: live ? "live" : "deterministic",
    total: results.length,
    passed,
    failed: results.length - passed,
    avgCharCount: Math.round(avgChars),
    results,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  if (passed < results.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
