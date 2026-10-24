import { describe, expect, test } from "bun:test";

import { createTtsV2AudioCache } from "@/lib/tts/tts-v2-audio-cache";

function entry(data: string, ts: number) {
  return { streamData: data, timestamp: ts };
}

describe("createTtsV2AudioCache", () => {
  test("evicts oldest entry when at capacity and inserting a new key", () => {
    const t = 1_000_000;
    const cache = createTtsV2AudioCache(2, 60_000, { now: () => t });
    cache.set("a", entry("A", t));
    cache.set("b", entry("B", t));
    cache.set("c", entry("C", t));

    expect(cache.get("a")).toBe(undefined);
    expect(cache.get("b")?.streamData).toBe("B");
    expect(cache.get("c")?.streamData).toBe("C");
  });

  test("get refreshes LRU so a touched key is not evicted next", () => {
    let t = 0;
    const cache = createTtsV2AudioCache(3, 60_000, { now: () => t });

    cache.set("k1", entry("1", t));
    cache.set("k2", entry("2", t));
    cache.set("k3", entry("3", t));

    expect(cache.get("k1")?.streamData).toBe("1");

    cache.set("k4", entry("4", t));

    expect(cache.get("k1")?.streamData).toBe("1");
    expect(cache.get("k2")).toBe(undefined);
    expect(cache.get("k3")?.streamData).toBe("3");
    expect(cache.get("k4")?.streamData).toBe("4");
  });

  test("removes expired entry on get and returns undefined", () => {
    let t = 0;
    const ttlMs = 1000;
    const cache = createTtsV2AudioCache(10, ttlMs, { now: () => t });

    cache.set("x", entry("payload", 0));
    expect(cache.get("x")?.streamData).toBe("payload");

    t = ttlMs + 1;
    expect(cache.get("x")).toBe(undefined);
    expect(cache.get("x")).toBe(undefined);
  });

  test("set on existing key updates value without requiring eviction", () => {
    const t = 2_000_000;
    const cache = createTtsV2AudioCache(2, 60_000, { now: () => t });
    cache.set("a", entry("v1", t));
    cache.set("b", entry("b", t));
    cache.set("a", entry("v2", t + 1));

    expect(cache.get("a")?.streamData).toBe("v2");
    expect(cache.get("b")?.streamData).toBe("b");
  });
});
