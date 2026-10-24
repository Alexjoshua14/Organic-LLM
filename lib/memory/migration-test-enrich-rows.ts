import "server-only";

import type {
  LegacyMarginalInfo,
  MigrationCompareEnrichedRow,
  V2MarginalInfo,
} from "@/lib/memory/memory-migration-test-types";
import type { MemoryItemType } from "@/lib/schemas/memory";

import { type MigrationCompareRow } from "@/lib/memory/migration-compare-rows";
import { getBestLegacyPointScoreForMemoryId } from "@/lib/memory/search-memories-legacy-qdrant";
import { getBestV2ChunkScoreForSourceMemory } from "@/lib/memory/search-memories-v2-qdrant";

function minScore(items: MemoryItemType[]): number | null {
  const nums = items.map((i) => i.score).filter((s): s is number => typeof s === "number");

  if (nums.length === 0) return null;

  return Math.min(...nums);
}

export async function enrichMigrationCompareRows(
  rows: MigrationCompareRow[],
  legacyResults: MemoryItemType[],
  v2Results: MemoryItemType[],
  userId: string,
  legacyQueryVector: number[],
  v2QueryVector: number[],
  v2Error?: string
): Promise<MigrationCompareEnrichedRow[]> {
  const lowestV2 = minScore(v2Results);
  const lowestLegacy = minScore(legacyResults);
  const out: MigrationCompareEnrichedRow[] = [];

  for (const row of rows) {
    if (row.kind === "merged") {
      out.push(row);
      continue;
    }

    const base: MigrationCompareEnrichedRow = {
      kind: "split",
      legacy: row.legacy,
      v2: row.v2,
    };

    if (row.legacy && !row.v2 && !v2Error && v2QueryVector.length > 0) {
      const best = await getBestV2ChunkScoreForSourceMemory(v2QueryVector, userId, row.legacy.id);

      if (best !== null) {
        const delta = lowestV2 !== null ? lowestV2 - best : null;
        const info: V2MarginalInfo = {
          existsInV2: true,
          bestChunkScore: best,
          lowestReturnedV2Score: lowestV2,
          deltaVsLowestReturned: delta,
        };

        base.v2Marginal = info;
      }
    }

    if (row.v2 && !row.legacy && legacyQueryVector.length > 0) {
      const best = await getBestLegacyPointScoreForMemoryId(legacyQueryVector, userId, row.v2.id);

      if (best !== null) {
        const delta = lowestLegacy !== null ? lowestLegacy - best : null;
        const info: LegacyMarginalInfo = {
          existsInLegacy: true,
          bestLegacyScore: best,
          lowestReturnedLegacyScore: lowestLegacy,
          deltaVsLowestReturned: delta,
        };

        base.legacyMarginal = info;
      }
    }

    out.push(base);
  }

  return out;
}
