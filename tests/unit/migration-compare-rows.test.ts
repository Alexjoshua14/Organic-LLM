import { describe, expect, test } from "bun:test";

import { buildMigrationCompareRows } from "@/lib/memory/migration-compare-rows";
import type { MemoryItemType } from "@/lib/schemas/memory";

const item = (id: string, memory: string, score?: number): MemoryItemType => ({
  id,
  memory,
  ...(score !== undefined ? { score } : {}),
});

describe("buildMigrationCompareRows", () => {
  test("merges when id and normalized text match", () => {
    const legacy = [item("a", "  hello   world  ")];
    const v2 = [item("a", "hello world")];
    const rows = buildMigrationCompareRows(legacy, v2);
    expect(rows).toEqual([{ kind: "merged", memory: legacy[0] }]);
  });

  test("splits when text differs for same id", () => {
    const legacy = [item("a", "one")];
    const v2 = [item("a", "two")];
    const rows = buildMigrationCompareRows(legacy, v2);
    expect(rows).toEqual([{ kind: "split", legacy: legacy[0], v2: v2[0] }]);
  });

  test("legacy order first, then unmatched v2 by score", () => {
    const legacy = [item("x", "L")];
    const v2 = [
      item("x", "L"),
      item("y", "low", 0.2),
      item("z", "high", 0.9),
    ];
    const rows = buildMigrationCompareRows(legacy, v2);
    expect(rows[0]).toEqual({ kind: "merged", memory: legacy[0] });
    expect(rows[1]).toEqual({ kind: "split", legacy: null, v2: v2[2] });
    expect(rows[2]).toEqual({ kind: "split", legacy: null, v2: v2[1] });
  });
});
