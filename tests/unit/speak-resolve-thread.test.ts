import { describe, expect, test } from "bun:test";

import {
  resolveSpeakThread,
  SPEAK_THREAD_FEATURE,
  SPEAK_THREAD_PATH,
  type ResolveSpeakThreadDeps,
} from "@/lib/speak/resolve-speak-thread";

type Calls = {
  created: number;
  routed: Array<{ id: string; feature?: string; path?: string }>;
};

function makeDeps(overrides: Partial<ResolveSpeakThreadDeps> = {}): {
  deps: ResolveSpeakThreadDeps;
  calls: Calls;
} {
  const calls: Calls = { created: 0, routed: [] };
  const deps: ResolveSpeakThreadDeps = {
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

describe("resolveSpeakThread", () => {
  test("resume-latest continues the newest speak thread with its title", async () => {
    const { deps, calls } = makeDeps({
      getLatestThreadByFeature: async (_owner, feature) => {
        expect(feature).toBe(SPEAK_THREAD_FEATURE);

        return { data: { id: "latest", updatedAt: "now", title: "Trip planning" }, error: null };
      },
    });

    const res = await resolveSpeakThread({ ownerId: "me", policy: "resume-latest" }, deps);

    expect(res).toEqual({ threadId: "latest", resumed: true, title: "Trip planning" });
    expect(calls.created).toBe(0);
  });

  test("creates and tags a thread when nothing is resumable", async () => {
    const { deps, calls } = makeDeps();
    const res = await resolveSpeakThread({ ownerId: "me", policy: "resume-latest" }, deps);

    expect(res).toEqual({ threadId: "new-thread", resumed: false, title: null });
    expect(calls.created).toBe(1);
    expect(calls.routed).toEqual([
      { id: "new-thread", feature: SPEAK_THREAD_FEATURE, path: SPEAK_THREAD_PATH },
    ]);
  });

  test("policy new ignores an existing thread", async () => {
    const { deps, calls } = makeDeps({
      getLatestThreadByFeature: async () => ({
        data: { id: "latest", updatedAt: "now", title: null },
        error: null,
      }),
    });

    const res = await resolveSpeakThread({ ownerId: "me", policy: "new" }, deps);

    expect(res.threadId).toBe("new-thread");
    expect(res.resumed).toBe(false);
    expect(calls.created).toBe(1);
  });

  test("honours an explicitly requested thread the caller owns", async () => {
    const { deps, calls } = makeDeps({
      getThreadOwnerContext: async (id) => ({ data: { threadId: id, ownerId: "me" }, error: null }),
    });

    const res = await resolveSpeakThread(
      { ownerId: "me", policy: "new", requestedThreadId: "mine" },
      deps
    );

    expect(res).toEqual({ threadId: "mine", resumed: true, title: null });
    expect(calls.created).toBe(0);
  });

  test("ignores a requested thread owned by someone else", async () => {
    const { deps, calls } = makeDeps({
      getThreadOwnerContext: async (id) => ({
        data: { threadId: id, ownerId: "someone-else" },
        error: null,
      }),
    });

    const res = await resolveSpeakThread(
      { ownerId: "me", policy: "resume-latest", requestedThreadId: "theirs" },
      deps
    );

    expect(res.threadId).toBe("new-thread");
    expect(calls.created).toBe(1);
  });

  test("reports a create failure without throwing so voice can still start", async () => {
    const { deps } = makeDeps({
      createChat: async () => ({ data: null, error: new Error("db down") }),
    });

    const res = await resolveSpeakThread({ ownerId: "me", policy: "new" }, deps);

    expect(res).toEqual({ threadId: null, resumed: false, title: null, error: "db down" });
  });
});
