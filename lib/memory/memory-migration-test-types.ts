import type { MemoryItemType, SearchResultType } from "@/lib/schemas/memory";

export type V2MarginalInfo = {
  existsInV2: true;
  bestChunkScore: number;
  lowestReturnedV2Score: number | null;
  /** `lowestReturnedV2Score - bestChunkScore`; positive means below weakest returned v2 hit. */
  deltaVsLowestReturned: number | null;
};

export type LegacyMarginalInfo = {
  existsInLegacy: true;
  bestLegacyScore: number;
  lowestReturnedLegacyScore: number | null;
  /** `lowestReturnedLegacyScore - bestLegacyScore`; positive means below weakest returned legacy hit. */
  deltaVsLowestReturned: number | null;
};

export type MigrationCompareEnrichedRow =
  | { kind: "merged"; memory: MemoryItemType }
  | {
      kind: "split";
      legacy: MemoryItemType | null;
      v2: MemoryItemType | null;
      v2Marginal?: V2MarginalInfo;
      legacyMarginal?: LegacyMarginalInfo;
    };

export type MemoryMigrationTestRun = {
  query: string;
  legacy: SearchResultType;
  v2: SearchResultType;
  rows: MigrationCompareEnrichedRow[];
  v2Error?: string;
};

export type MemoryMigrationTestResponse = {
  runs: MemoryMigrationTestRun[];
  synopsis?: string | null;
  synopsisError?: string;
  synopsisSkippedReason?: string | null;
};
