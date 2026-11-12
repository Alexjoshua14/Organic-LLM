import { describe, expect, mock, test } from "bun:test";

import type { HomepageRouteCandidate } from "@/lib/chat/thread-routing-candidates";

import { createCueCache, cueCacheKey, toCue } from "@/lib/launcher/launcher-cue-cache";
import { LAUNCHER_CUE_MAX_CHARS } from "@/lib/launcher/launcher-timing";

function candidate(
  partial: Partial<HomepageRouteCandidate> & { routeKey: string }
): HomepageRouteCandidate {
  return {
    kind: "thread",
    title: partial.routeKey,
    feature: "main",
    href: `/chat/${partial.routeKey}`,
    summaryText: null,
    ...partial,
  };
}

describe("toCue", () => {
  test("collapses whitespace and drops empty summaries", () => {
    expect(toCue("  Weighing\n\ncapture   vs save ")).toBe("Weighing capture vs save");
    expect(toCue("   ")).toBeNull();
    expect(toCue(null)).toBeNull();
  });

  test("bounds every cue, which bounds the cache's memory", () => {
    const cue = toCue("word ".repeat(200));

    expect(cue).not.toBeNull();
    expect(cue!.length).toBeLessThanOrEqual(LAUNCHER_CUE_MAX_CHARS);
    expect(cue!.endsWith("…")).toBe(true);
  });
});

describe("createCueCache", () => {
  test("stores cues for threads only, keyed by thread id", async () => {
    const cache = createCueCache();
    const fetcher = mock(async () => [
      candidate({ routeKey: "t1", summaryText: "First idea" }),
      candidate({ routeKey: "t2", summaryText: null }),
      candidate({ routeKey: "rabbit_hole:s1", kind: "rabbit_hole", summaryText: "Not a thread" }),
    ]);

    await cache.load("u:main", fetcher);

    expect([...cache.peek("u:main")]).toEqual([["t1", "First idea"]]);
  });

  test("concurrent loads share one request", async () => {
    const cache = createCueCache();
    let release: (value: HomepageRouteCandidate[]) => void = () => {};
    const fetcher = mock(
      () => new Promise<HomepageRouteCandidate[]>((resolve) => (release = resolve))
    );

    const first = cache.load("u:main", fetcher);
    const second = cache.load("u:main", fetcher);

    release([candidate({ routeKey: "t1", summaryText: "x" })]);
    await Promise.all([first, second]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("fresh cues are reused; stale ones revalidate while the old ones stay readable", async () => {
    let clock = 1_000;
    const cache = createCueCache({ ttlMs: 60_000, now: () => clock });
    const fetcher = mock(async () => [candidate({ routeKey: "t1", summaryText: "v1" })]);

    await cache.load("u:main", fetcher);
    clock += 59_000;
    await cache.load("u:main", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.isFresh("u:main")).toBe(true);

    clock += 2_000;
    expect(cache.isFresh("u:main")).toBe(false);
    // Stale cues are still what a card shows while the refresh runs.
    expect(cache.peek("u:main").get("t1")).toBe("v1");

    fetcher.mockImplementation(async () => [candidate({ routeKey: "t1", summaryText: "v2" })]);
    await cache.load("u:main", fetcher);
    expect(cache.peek("u:main").get("t1")).toBe("v2");
  });

  test("a failed fetch never throws and keeps the previous cues", async () => {
    let clock = 0;
    const cache = createCueCache({ ttlMs: 10, now: () => clock });

    await cache.load("u:main", async () => [candidate({ routeKey: "t1", summaryText: "kept" })]);
    clock += 100;
    await cache.load("u:main", async () => {
      throw new Error("offline");
    });

    expect(cache.peek("u:main").get("t1")).toBe("kept");
    // The failure is not remembered as fresh, so the next open tries again.
    expect(cache.isFresh("u:main")).toBe(false);
  });

  test("holds one key at a time, so another account never sees the first one's cues", async () => {
    const cache = createCueCache();

    await cache.load("alice:main", async () => [candidate({ routeKey: "t1", summaryText: "a" })]);
    await cache.load("bob:main", async () => [candidate({ routeKey: "t9", summaryText: "b" })]);

    expect(cache.peek("alice:main").size).toBe(0);
    expect([...cache.peek("bob:main")]).toEqual([["t9", "b"]]);
  });

  test("peek is a stable snapshot until something changes, and subscribers hear about changes", async () => {
    const cache = createCueCache();
    const listener = mock(() => {});
    const unsubscribe = cache.subscribe(listener);

    expect(cache.peek("u:main")).toBe(cache.peek("u:main"));
    await cache.load("u:main", async () => [candidate({ routeKey: "t1", summaryText: "x" })]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cache.peek("u:main")).toBe(cache.peek("u:main"));

    unsubscribe();
    cache.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cache.peek("u:main").size).toBe(0);
  });

  test("keys separate users and scopes", () => {
    expect(cueCacheKey("u1", false)).toBe("u1:main");
    expect(cueCacheKey("u1", true)).toBe("u1:all");
  });
});
