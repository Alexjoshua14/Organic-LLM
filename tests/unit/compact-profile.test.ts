import { describe, expect, test } from "bun:test";

import type { MemoryItemType } from "@/lib/schemas/memory";
import type { ProfileTree } from "@/lib/schemas/profileTree";

import { compactProfileTree, trimMemoryPackToTokenCap } from "@/lib/memory/compact-profile";

const tree: ProfileTree = {
  headline: "Alex Joshua",
  roles: ["Engineer", "Designer"],
  signature: "Coalescence Labs",
  sections: [
    {
      id: "work",
      title: "Work",
      body: "Builds Organic LLM, a cognition lab.",
      items: ["Next.js", "Mem0"],
    },
    {
      id: "food",
      title: "Food",
      body: "Prefers pasta on weeknights.",
      items: ["Pasta"],
    },
    {
      id: "extra",
      title: "Extra",
      body: "This third section should drop on Quick.",
      items: ["Drop me"],
    },
  ],
};

function mem(id: string, memory: string, score: number): MemoryItemType {
  return { id, memory, score };
}

describe("compactProfileTree", () => {
  test("Quick keeps headline, roles, signature, and two sections", () => {
    const text = compactProfileTree(tree, {
      maxSections: 2,
      rich: false,
      tokenCap: 400,
    });

    expect(text).toContain("Alex Joshua");
    expect(text).toContain("Roles: Engineer, Designer");
    expect(text).toContain("Coalescence Labs");
    expect(text).toContain("## Work");
    expect(text).toContain("## Food");
    expect(text).not.toContain("## Extra");
  });

  test("missing tree returns empty string", () => {
    expect(compactProfileTree(null, { maxSections: 2, rich: false, tokenCap: 400 })).toBe("");
  });

  test("token cap truncates the portrait", () => {
    const text = compactProfileTree(tree, {
      maxSections: 6,
      rich: true,
      tokenCap: 20,
    });

    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThan(200);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("trimMemoryPackToTokenCap", () => {
  test("drops trailing (lowest) memories before shrinking the portrait", () => {
    const memories = [
      mem("a", "high score memory about the flagship roadmap and next release", 0.9),
      mem("b", "mid score memory about pasta and weeknight cooking habits", 0.5),
      mem("c", "low score memory that should be the first to drop from the pack", 0.3),
    ];
    const result = trimMemoryPackToTokenCap({
      portraitText: "Alex Joshua. Engineer.",
      memories,
      tokenCap: 40,
    });

    expect(result.memories.map((item) => item.id)).not.toContain("c");
    expect(result.memories.length).toBeLessThan(memories.length);
  });

  test("zero cap clears the pack", () => {
    const result = trimMemoryPackToTokenCap({
      portraitText: "Alex",
      memories: [mem("a", "hit", 0.9)],
      tokenCap: 0,
    });

    expect(result).toEqual({ portraitText: "", memories: [], memoriesText: "" });
  });
});
