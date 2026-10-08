import type { HomepageRouteCandidate } from "@/lib/chat/thread-routing-candidates";
import type { MemoryItemType } from "@/lib/schemas/memory";

import { describe, expect, test } from "bun:test";

import {
  buildResurfacePool,
  collectResurfaceCandidates,
  RESURFACE_CANDIDATE_TEXT_MAX_CHARS,
  RESURFACE_POOL_CAPS,
} from "@/lib/resurface/candidates";

function memory(id: string, text: string, createdAt: string): MemoryItemType {
  return { id, memory: text, createdAt };
}

function routed(
  kind: HomepageRouteCandidate["kind"],
  key: string,
  title: string,
  summaryText: string | null = null
): HomepageRouteCandidate {
  return { routeKey: key, kind, title, feature: kind, href: `/${key}`, summaryText };
}

describe("buildResurfacePool", () => {
  test("memories come newest first, ahead of chats, rabbit holes and Strata", () => {
    const pool = buildResurfacePool({
      memories: [
        memory("old", "Old thought", "2026-01-01T00:00:00Z"),
        memory("new", "New thought", "2026-09-01T00:00:00Z"),
      ],
      routed: [
        routed("strata_page", "strata:s1", "Notes"),
        routed("thread", "t1", "Trip plan", "Planning Lisbon."),
        routed("rabbit_hole", "rh:r1", "Why cities hum"),
      ],
    });

    expect(pool.map((c) => c.key)).toEqual([
      "memory:new",
      "memory:old",
      "t1",
      "rh:r1",
      "strata:s1",
    ]);
    expect(pool[2]).toMatchObject({ title: "Trip plan", text: "Planning Lisbon.", href: "/t1" });
    expect(pool[0]!.href).toBeNull();
  });

  test("an untitled chat with no summary has nothing to resurface", () => {
    const pool = buildResurfacePool({
      memories: [],
      routed: [
        routed("thread", "t1", "Untitled chat"),
        routed("thread", "t2", "Untitled chat", "x"),
      ],
    });

    expect(pool.map((c) => c.key)).toEqual(["t2"]);
  });

  test("each kind is capped and long bodies are cut", () => {
    const threads = Array.from({ length: 40 }, (_, i) =>
      routed("thread", `t${i}`, `Chat ${i}`, "s".repeat(2_000))
    );
    const pool = buildResurfacePool({ memories: [], routed: threads });

    expect(pool).toHaveLength(RESURFACE_POOL_CAPS.thread);
    expect(pool[0]!.text.length).toBe(RESURFACE_CANDIDATE_TEXT_MAX_CHARS + 1);
  });
});

describe("collectResurfaceCandidates", () => {
  test("one source failing leaves the other", async () => {
    const pool = await collectResurfaceCandidates("owner-1", {
      getMemories: async () => {
        throw new Error("Mem0 down");
      },
      loadRouted: async () => ({ data: [routed("thread", "t1", "Chat", "Sum")], error: null }),
    });

    expect(pool.map((c) => c.key)).toEqual(["t1"]);
  });

  test("asks for the widest routed view (coalescence on)", async () => {
    let coalescence: boolean | null = null;

    await collectResurfaceCandidates("owner-1", {
      getMemories: async () => ({ data: { results: [] }, error: null }),
      loadRouted: async (mode) => {
        coalescence = mode;

        return { data: [], error: null };
      },
    });

    expect(coalescence).toBe(true);
  });
});
