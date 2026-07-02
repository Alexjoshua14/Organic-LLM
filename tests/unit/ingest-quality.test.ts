import { describe, expect, test } from "bun:test";

import {
  distillCandidateFromTurns,
  parseMemoryQualityFromModelText,
  scoreIngestOutputDeterministic,
} from "@/lib/memory/ingest-quality";
import { MEMORY_INGEST_GOLDEN_CASES } from "@/test-data/memory-ingest-golden";

describe("parseMemoryQualityFromModelText", () => {
  test("parses valid keep/drop JSON", () => {
    expect(parseMemoryQualityFromModelText('{"decision":"keep","reason":"durable fact"}')).toEqual({
      decision: "keep",
      reason: "durable fact",
    });
  });

  test("repairs JSON-schema-shaped envelope", () => {
    const raw = JSON.stringify({
      type: "object",
      properties: { decision: "drop", reason: "generic" },
    });

    expect(parseMemoryQualityFromModelText(raw)).toEqual({
      decision: "drop",
      reason: "generic",
    });
  });
});

describe("scoreIngestOutputDeterministic", () => {
  test("passes when expected facts present and no anti-patterns", () => {
    const c = MEMORY_INGEST_GOLDEN_CASES[0]!;
    const output = "User prefers dark mode for all applications.";

    const score = scoreIngestOutputDeterministic(c.id, output, c);

    expect(score.passed).toBe(true);
    expect(score.missingFacts).toEqual([]);
  });

  test("rejection cases pass when anti-patterns are detected", () => {
    const c = MEMORY_INGEST_GOLDEN_CASES[3]!;
    const output = "Latency tells you how fast.";

    const score = scoreIngestOutputDeterministic(c.id, output, c);

    expect(score.passed).toBe(true);
    expect(score.antiPatternHits.length).toBeGreaterThan(0);
  });

  test("positive cases fail when anti-patterns appear", () => {
    const c = MEMORY_INGEST_GOLDEN_CASES[0]!;
    const output = "Latency tells you how fast.";

    const score = scoreIngestOutputDeterministic(c.id, output, c);

    expect(score.passed).toBe(false);
  });
});

describe("distillCandidateFromTurns", () => {
  test("uses last user turn", () => {
    const c = MEMORY_INGEST_GOLDEN_CASES[0]!;

    expect(distillCandidateFromTurns(c.turns)).toContain("dark mode");
  });
});

describe("golden fixture sanity", () => {
  test("all cases have ids and turns", () => {
    expect(MEMORY_INGEST_GOLDEN_CASES.length).toBeGreaterThanOrEqual(5);
    for (const c of MEMORY_INGEST_GOLDEN_CASES) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.turns.length).toBeGreaterThan(0);
    }
  });
});
