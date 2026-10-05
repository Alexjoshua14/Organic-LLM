import { describe, expect, test } from "bun:test";

import type { MemoryItemType } from "@/lib/schemas/memory";
import {
  clusterMemoriesIntoSectors,
  findSectorIdForMemory,
  MEMORY_MINDMAP_OTHER_LABEL,
  MEMORY_MINDMAP_ROOT_FOCUS,
  canDrillIntoSector,
  childSectorsForFocus,
  focusFromSector,
  memoryItemToTrace,
} from "@/lib/memory/mindmap";

describe("clusterMemoriesIntoSectors", () => {
  test("empty corpus yields no sectors", () => {
    expect(clusterMemoriesIntoSectors([])).toEqual([]);
  });

  test("explicit topic becomes the sector label and wins over wording", () => {
    const sectors = clusterMemoriesIntoSectors([
      { id: "a", text: "Drinks pour-over coffee every morning.", topic: "Places" },
      { id: "b", text: "Lives in Portland.", topic: "Places" },
    ]);

    expect(sectors).toHaveLength(1);
    expect(sectors[0]?.label).toBe("Places");
    expect(sectors[0]?.memoryIds).toEqual(["a", "b"]);
  });

  test("untagged memories that share tokens form one inferred sector", () => {
    const sectors = clusterMemoriesIntoSectors([
      { id: "a", text: "Drinks pour-over coffee every morning." },
      { id: "b", text: "Takes coffee black, no sugar." },
    ]);

    expect(sectors).toHaveLength(1);
    expect(sectors[0]?.label).toBe("Coffee");
    expect(sectors[0]?.memoryIds).toEqual(["a", "b"]);
  });

  test("tied top tokens compose a two-word label", () => {
    const sectors = clusterMemoriesIntoSectors([
      { id: "a", text: "Building Organic LLM as a lab." },
      { id: "b", text: "Organic LLM runs locally." },
    ]);

    expect(sectors).toHaveLength(1);
    expect(sectors[0]?.label).toBe("Organic LLM");
  });

  test("tokenless leftovers land in Other", () => {
    const sectors = clusterMemoriesIntoSectors([{ id: "a", text: "to be or not" }]);

    expect(sectors).toHaveLength(1);
    expect(sectors[0]?.label).toBe(MEMORY_MINDMAP_OTHER_LABEL);
    expect(sectors[0]?.memoryIds).toEqual(["a"]);
  });

  test("overflow beyond maxSectors merges into Other", () => {
    const memories = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`,
      text: `Willow${i} lantern${i}`,
    }));
    const sectors = clusterMemoriesIntoSectors(memories, { maxSectors: 3 });

    expect(sectors.length).toBeLessThanOrEqual(3);
    expect(sectors.some((s) => s.label === MEMORY_MINDMAP_OTHER_LABEL)).toBe(true);
    expect(sectors.flatMap((s) => s.memoryIds).sort()).toEqual(memories.map((m) => m.id));
  });
});

describe("memoryItemToTrace", () => {
  test("lifts metadata.topic when it is a non-empty string", () => {
    const item: MemoryItemType = {
      id: "1",
      memory: "Lives in Portland.",
      metadata: { topic: " Home " },
    };

    expect(memoryItemToTrace(item)).toEqual({
      id: "1",
      text: "Lives in Portland.",
      topic: "Home",
    });
  });

  test("omits topic when metadata is missing or not a string", () => {
    const item: MemoryItemType = { id: "1", memory: "Lives in Portland." };

    expect(memoryItemToTrace(item).topic).toBeUndefined();
  });
});

describe("findSectorIdForMemory", () => {
  test("returns the sector that owns the memory", () => {
    const sectors = clusterMemoriesIntoSectors([
      { id: "a", text: "Coffee in the morning." },
      { id: "b", text: "Coffee black." },
    ]);

    expect(findSectorIdForMemory(sectors, "a")).toBe(sectors[0]?.id);
    expect(findSectorIdForMemory(sectors, "missing")).toBeUndefined();
  });
});

describe("mindmap drill-down", () => {
  const coffee = [
    { id: "a", text: "Drinks pour-over coffee every morning." },
    { id: "b", text: "Takes coffee black, no sugar." },
  ];

  test("deeper layer ignores the parent token and splits the sector", () => {
    const root = clusterMemoriesIntoSectors(coffee);
    const coffeeSector = root[0];

    expect(coffeeSector?.label).toBe("Coffee");
    if (!coffeeSector) throw new Error("expected coffee sector");

    const kids = childSectorsForFocus(coffee, focusFromSector(MEMORY_MINDMAP_ROOT_FOCUS, coffeeSector));

    expect(kids.length).toBeGreaterThan(1);
    expect(kids.every((k) => k.label.toLowerCase() !== "coffee")).toBe(true);
    expect(kids.flatMap((k) => k.memoryIds).sort()).toEqual(["a", "b"]);
  });

  test("a single-memory sector is a leaf", () => {
    const traces = [{ id: "a", text: "Drinks pour-over coffee every morning." }];
    const root = clusterMemoriesIntoSectors(traces);
    const sector = root[0];

    expect(sector).toBeDefined();
    if (!sector) throw new Error("expected sector");
    expect(canDrillIntoSector(traces, MEMORY_MINDMAP_ROOT_FOCUS, sector)).toBe(false);
  });
});
