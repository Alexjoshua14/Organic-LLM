import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import type { ActiveStreamMarker } from "@/data/supabase/active-streams";
import type { StaleStreamSweepDeps, StreamLiveness } from "@/lib/chat/stale-stream-sweep";

import { isAuthorizedCronRequest } from "@/lib/cron/authorize-cron-request";
import {
  STALE_STREAM_IDLE_MS,
  STALE_STREAM_SWEEP_BATCH,
  sweepStaleActiveStreams,
} from "@/lib/chat/stale-stream-sweep";

const NOW = new Date("2026-09-29T12:00:00Z");

function marker(threadId: string, streamId = `stream-${threadId}`): ActiveStreamMarker {
  return { threadId, streamId, updatedAt: "2026-09-29T11:00:00Z" };
}

/** Deps over an in-memory table: `status` per stream id, markers cleared by compare-and-set. */
function fakeDeps(
  markers: ActiveStreamMarker[],
  status: Record<string, StreamLiveness | Error>
): StaleStreamSweepDeps & { calls: { idleBefore?: Date; limit?: number; cleared: string[] } } {
  const current = new Map(markers.map((m) => [m.threadId, m.streamId]));
  const calls: { idleBefore?: Date; limit?: number; cleared: string[] } = { cleared: [] };

  return {
    calls,
    listIdle: async (idleBefore, limit) => {
      calls.idleBefore = idleBefore;
      calls.limit = limit;

      return markers;
    },
    streamStatus: async (streamId) => {
      const answer = status[streamId] ?? null;

      if (answer instanceof Error) throw answer;

      return answer;
    },
    clear: async (threadId, streamId) => {
      if (current.get(threadId) !== streamId) return false;
      current.delete(threadId);
      calls.cleared.push(threadId);

      return true;
    },
  };
}

describe("sweepStaleActiveStreams", () => {
  test("only asks about markers idle for the full threshold, in bounded batches", async () => {
    const deps = fakeDeps([], {});

    await sweepStaleActiveStreams({ now: NOW, deps });

    expect(deps.calls.idleBefore?.getTime()).toBe(NOW.getTime() - STALE_STREAM_IDLE_MS);
    expect(deps.calls.limit).toBe(STALE_STREAM_SWEEP_BATCH);
  });

  test("clears markers whose stream is gone or finished, and never a live one", async () => {
    const deps = fakeDeps([marker("gone"), marker("done"), marker("live")], {
      "stream-gone": null,
      "stream-done": "DONE",
      "stream-live": true,
    });

    const report = await sweepStaleActiveStreams({ now: NOW, deps });

    expect(deps.calls.cleared).toEqual(["gone", "done"]);
    expect(report).toEqual({ checked: 3, cleared: 2, live: 1, changed: 0, failed: 0 });
  });

  test("leaves a thread alone when its marker changed after the read", async () => {
    const deps = fakeDeps([marker("restarted", "old-stream")], { "old-stream": null });

    // A new stream started on this thread between the list and the clear.
    deps.clear = async () => false;

    const report = await sweepStaleActiveStreams({ now: NOW, deps });

    expect(report).toEqual({ checked: 1, cleared: 0, live: 0, changed: 1, failed: 0 });
  });

  test("an unverifiable stream is not cleared, and does not stop the rest", async () => {
    const deps = fakeDeps([marker("redis-down"), marker("gone")], {
      "stream-redis-down": new Error("REDIS_URL environment variable is not set"),
      "stream-gone": null,
    });

    const report = await sweepStaleActiveStreams({ now: NOW, deps });

    expect(deps.calls.cleared).toEqual(["gone"]);
    expect(report).toEqual({ checked: 2, cleared: 1, live: 0, changed: 0, failed: 1 });
  });
});

describe("isAuthorizedCronRequest", () => {
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  const request = (authorization?: string) =>
    new Request("https://app.test/api/cron/sweep-stale-streams", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    });

  test("is closed when no secret is configured, even to an empty bearer", () => {
    delete process.env.CRON_SECRET;

    expect(isAuthorizedCronRequest(request("Bearer "))).toBe(false);
    expect(isAuthorizedCronRequest(request())).toBe(false);
  });

  test("accepts only the exact bearer", () => {
    process.env.CRON_SECRET = "s3cret";

    expect(isAuthorizedCronRequest(request("Bearer s3cret"))).toBe(true);
    expect(isAuthorizedCronRequest(request("Bearer s3cre"))).toBe(false);
    expect(isAuthorizedCronRequest(request("s3cret"))).toBe(false);
    expect(isAuthorizedCronRequest(request())).toBe(false);
  });
});
