import { describe, expect, test } from "bun:test";

import {
  resolveFeatureThread,
  type ResolveFeatureThreadDeps,
} from "@/lib/chat/resolve-feature-thread";
import {
  AION_THREAD_FEATURE,
  AION_THREAD_PATH,
} from "@/lib/schemas/aion-presence";

type Calls = {
  created: number;
  routed: Array<{ id: string; feature?: string; path?: string }>;
};

function makeDeps(overrides: Partial<ResolveFeatureThreadDeps> = {}): {
  deps: ResolveFeatureThreadDeps;
  calls: Calls;
} {
  const calls: Calls = { created: 0, routed: [] };
  const deps: ResolveFeatureThreadDeps = {
    getLatestThreadByFeature: async () => ({ data: null, error: null }),
    getThreadOwnerContext: async () => ({ data: null, error: new Error("not found") }),
    createChat: async () => {
      calls.created += 1;

      return { data: "new-thread", error: null };
    },
    updateThreadRouting: async (id, routing) => {
      calls.routed.push({ id, ...routing });

      return { ok: true, error: null };
    },
    ...overrides,
  };

  return { deps, calls };
}

describe("resolveFeatureThread", () => {
  test("resume-latest continues the newest feature thread", async () => {
    const { deps, calls } = makeDeps({
      getLatestThreadByFeature: async (_owner, feature) => {
        expect(feature).toBe(AION_THREAD_FEATURE);

        return { data: { id: "latest", updatedAt: "now", title: "Presence" }, error: null };
      },
    });

    const res = await resolveFeatureThread(
      {
        ownerId: "me",
        feature: AION_THREAD_FEATURE,
        path: AION_THREAD_PATH,
        policy: "resume-latest",
      },
      deps
    );

    expect(res).toEqual({ threadId: "latest", resumed: true, title: "Presence" });
    expect(calls.created).toBe(0);
  });

  test("creates and tags a thread when nothing is resumable", async () => {
    const { deps, calls } = makeDeps();
    const res = await resolveFeatureThread(
      {
        ownerId: "me",
        feature: AION_THREAD_FEATURE,
        path: AION_THREAD_PATH,
        policy: "resume-latest",
      },
      deps
    );

    expect(res).toEqual({ threadId: "new-thread", resumed: false, title: null });
    expect(calls.created).toBe(1);
    expect(calls.routed).toEqual([
      { id: "new-thread", feature: AION_THREAD_FEATURE, path: AION_THREAD_PATH },
    ]);
  });
});
