import { describe, expect, it } from "bun:test";

import { tabTitleCacheDigest } from "@/lib/metadata/tab-title-cache";

describe("tabTitleCacheDigest", () => {
  it("is stable for the same parts", () => {
    const parts = ["chat-tab", "arcadia", "550e8400-e29b-41d4-a716-446655440000", "2025-01-01", "Hi"] as const;
    expect(tabTitleCacheDigest(parts)).toBe(tabTitleCacheDigest(parts));
  });

  it("changes when revision changes", () => {
    const a = tabTitleCacheDigest(["chat-tab", "chat", "id-1", "t1", "title"]);
    const b = tabTitleCacheDigest(["chat-tab", "chat", "id-1", "t2", "title"]);

    expect(a).not.toBe(b);
  });
});
