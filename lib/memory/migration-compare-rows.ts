import type { MemoryItemType } from "@/lib/schemas/memory";

export type MigrationCompareRow =
  | { kind: "merged"; memory: MemoryItemType }
  | { kind: "split"; legacy: MemoryItemType | null; v2: MemoryItemType | null };

function normalizeForCompare(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Builds UI rows in **legacy search order**: walk legacy results first, then append
 * unmatched v2 memories sorted by score descending.
 */
export function buildMigrationCompareRows(
  legacyResults: MemoryItemType[],
  v2Results: MemoryItemType[]
): MigrationCompareRow[] {
  const v2ById = new Map(v2Results.map((m) => [m.id, m]));
  const consumedV2 = new Set<string>();
  const rows: MigrationCompareRow[] = [];

  for (const L of legacyResults) {
    const V = v2ById.get(L.id);

    if (V && normalizeForCompare(V.memory) === normalizeForCompare(L.memory)) {
      rows.push({ kind: "merged", memory: L });
      consumedV2.add(V.id);
    } else if (V) {
      rows.push({ kind: "split", legacy: L, v2: V });
      consumedV2.add(V.id);
    } else {
      rows.push({ kind: "split", legacy: L, v2: null });
    }
  }

  const remainingV2 = v2Results
    .filter((m) => !consumedV2.has(m.id))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const V of remainingV2) {
    rows.push({ kind: "split", legacy: null, v2: V });
  }

  return rows;
}
