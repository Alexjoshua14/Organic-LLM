import { describe, expect, test } from "bun:test";

import type { MemoryItemType } from "@/lib/schemas/memory";
import {
  ARCADIA_MEMORY_MIN_SCORE,
  bucketMemoriesByTier,
  passesMinScoreForInjection,
  selectMemoriesForPrompt,
} from "@/lib/memory/memory-relevance";

function mem(id: string, text: string, score?: number): MemoryItemType {
  return { id, memory: text, ...(score === undefined ? {} : { score }) };
}

describe("bucketMemoriesByTier", () => {
  test("buckets boundaries: >0.7 tier1, (0.4,0.7] tier2, (min,0.4] tier3", () => {
    const items = [
      mem("1", "a", 0.71),
      mem("2", "b", 0.7),
      mem("3", "c", 0.41),
      mem("4", "d", 0.4),
      mem("5", "e", 0.26),
    ];
    const b = bucketMemoriesByTier(items, ARCADIA_MEMORY_MIN_SCORE);

    expect(b.tier1).toBe(1);
    expect(b.tier2).toBe(2);
    expect(b.tier3).toBe(2);
    expect(b.belowThreshold).toBe(0);
    expect(b.noScore).toBe(0);
    expect(b.sampleSize).toBe(5);
  });

  test("below min score and no score", () => {
    const items = [
      mem("1", "low", 0.1),
      mem("2", "none"),
      mem("3", "edge", ARCADIA_MEMORY_MIN_SCORE),
    ];
    const b = bucketMemoriesByTier(items, ARCADIA_MEMORY_MIN_SCORE);

    expect(b.belowThreshold).toBe(2);
    expect(b.noScore).toBe(1);
    expect(b.tier1 + b.tier2 + b.tier3).toBe(0);
  });
});

describe("passesMinScoreForInjection", () => {
  test("missing score passes", () => {
    expect(passesMinScoreForInjection(mem("1", "x"), ARCADIA_MEMORY_MIN_SCORE)).toBe(true);
  });

  test("at min passes", () => {
    expect(
      passesMinScoreForInjection(mem("1", "x", ARCADIA_MEMORY_MIN_SCORE), ARCADIA_MEMORY_MIN_SCORE)
    ).toBe(true);
  });

  test("below min fails", () => {
    expect(passesMinScoreForInjection(mem("1", "x", 0.1), ARCADIA_MEMORY_MIN_SCORE)).toBe(false);
  });
});

describe("selectMemoriesForPrompt", () => {
  test("caps at maxIncluded and prefers higher scores", () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      mem(`id-${i}`, `m${i}`, 0.3 + i * 0.05)
    );
    const picked = selectMemoriesForPrompt(items, {
      maxIncluded: 10,
      minScore: ARCADIA_MEMORY_MIN_SCORE,
    });

    expect(picked.length).toBe(10);
    const scores = picked.map((p) => p.score!);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]! >= scores[i]!).toBe(true);
    }
  });

  test("includes no-score items and respects minScore", () => {
    const items = [
      mem("a", "ns"),
      mem("b", "hi", 0.9),
      mem("c", "lo", 0.1),
    ];
    const picked = selectMemoriesForPrompt(items, {
      maxIncluded: 10,
      minScore: ARCADIA_MEMORY_MIN_SCORE,
    });

    expect(picked.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
