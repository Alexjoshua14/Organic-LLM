import { beforeEach, describe, expect, mock, test } from "bun:test";

import { resetSpatialArtifactSyncQueue } from "../helpers/spatial-artifacts-sync-queue";
import {
  sharedRatelimitLimit as mockLimit,
} from "../helpers/rate-limit-upstash";

import {
  isSpatialArtifactsEnabled,
  isSpatialArtifactsEnabledFromRequest,
} from "@/lib/spatial-artifacts/coalescence-gate";
import { shouldSkipSyncDebounced } from "@/lib/spatial-artifacts/sync/sync-debounce";
import {
  clearQueueForOwner,
  dequeueArtifactSync,
  enqueueArtifactSync,
  queueLength,
  type ArtifactSyncJob,
} from "@/lib/spatial-artifacts/sync/sync-queue";
import { Semaphore } from "@/lib/spatial-artifacts/sync/sync-semaphore";

const mockGetSettings = mock(() => ({ coalescenceMode: false }));

mock.module("@/lib/user-settings", () => ({
  getSettings: mockGetSettings,
}));

function baseJob(overrides: Partial<ArtifactSyncJob> = {}): ArtifactSyncJob {
  return {
    artifactId: "thread-1:call_a",
    ownerId: "owner-1",
    threadId: "thread-1",
    messageId: "msg-1",
    toolCallId: "call_a",
    priority: "normal",
    coalescenceMode: true,
    ...overrides,
  };
}

describe("coalescence-gate", () => {
  beforeEach(() => {
    mockGetSettings.mockClear();
  });

  test("isSpatialArtifactsEnabled reads coalescenceMode from settings", () => {
    mockGetSettings.mockReturnValueOnce({ coalescenceMode: true });
    expect(isSpatialArtifactsEnabled()).toBe(true);

    mockGetSettings.mockReturnValueOnce({ coalescenceMode: false });
    expect(isSpatialArtifactsEnabled()).toBe(false);
  });

  test("isSpatialArtifactsEnabledFromRequest requires explicit true", () => {
    expect(isSpatialArtifactsEnabledFromRequest(true)).toBe(true);
    expect(isSpatialArtifactsEnabledFromRequest(false)).toBe(false);
    expect(isSpatialArtifactsEnabledFromRequest(undefined)).toBe(false);
  });
});

describe("shouldSkipSyncDebounced", () => {
  test("skips when snapshot was updated within 5 minutes for normal priority", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();

    expect(
      shouldSkipSyncDebounced(recent, { priority: "normal" })
    ).toBe(true);
  });

  test("does not skip when force is set", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();

    expect(
      shouldSkipSyncDebounced(recent, { priority: "normal", force: true })
    ).toBe(false);
  });

  test("does not skip for high priority", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();

    expect(
      shouldSkipSyncDebounced(recent, { priority: "high" })
    ).toBe(false);
  });

  test("does not skip when snapshot timestamp is missing or invalid", () => {
    expect(shouldSkipSyncDebounced(null, { priority: "normal" })).toBe(false);
    expect(shouldSkipSyncDebounced("not-a-date", { priority: "normal" })).toBe(false);
  });

  test("does not skip when snapshot is older than debounce window", () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();

    expect(shouldSkipSyncDebounced(old, { priority: "normal" })).toBe(false);
  });
});

describe("sync-queue", () => {
  beforeEach(() => {
    resetSpatialArtifactSyncQueue();
  });

  test("no-ops when coalescenceMode is off", () => {
    enqueueArtifactSync(baseJob({ coalescenceMode: false }));

    expect(queueLength()).toBe(0);
  });

  test("dedupes by artifactId and upgrades priority", () => {
    enqueueArtifactSync(baseJob({ priority: "low" }));
    enqueueArtifactSync(baseJob({ priority: "high", force: true, pin: true }));

    expect(queueLength()).toBe(1);

    const job = dequeueArtifactSync();

    expect(job?.priority).toBe("high");
    expect(job?.force).toBe(true);
    expect(job?.pin).toBe(true);
  });

  test("orders jobs by priority", () => {
    enqueueArtifactSync(baseJob({ artifactId: "a", priority: "low" }));
    enqueueArtifactSync(baseJob({ artifactId: "b", priority: "high" }));
    enqueueArtifactSync(baseJob({ artifactId: "c", priority: "normal" }));

    expect(dequeueArtifactSync()?.artifactId).toBe("b");
    expect(dequeueArtifactSync()?.artifactId).toBe("c");
    expect(dequeueArtifactSync()?.artifactId).toBe("a");
  });

  test("clearQueueForOwner removes only matching owner jobs", () => {
    enqueueArtifactSync(baseJob({ artifactId: "a", ownerId: "owner-1" }));
    enqueueArtifactSync(baseJob({ artifactId: "b", ownerId: "owner-2" }));

    clearQueueForOwner("owner-1");

    expect(queueLength()).toBe(1);
    expect(dequeueArtifactSync()?.artifactId).toBe("b");
  });
});

describe("Semaphore", () => {
  test("caps concurrent holders and releases waiters", async () => {
    const sem = new Semaphore(2);
    const releases: Array<() => void> = [];

    releases.push(await sem.acquire());
    releases.push(await sem.acquire());

    let thirdAcquired = false;
    const third = sem.acquire().then((release) => {
      thirdAcquired = true;
      releases.push(release);
    });

    await Promise.resolve();
    expect(thirdAcquired).toBe(false);

    releases.shift()?.();
    await third;
    expect(thirdAcquired).toBe(true);

    for (const release of releases) release();
  });
});

describe("checkSpatialArtifactSyncLimit", () => {
  let checkSpatialArtifactSyncLimit: typeof import("@/lib/spatial-artifacts/sync/sync-rate-limit").checkSpatialArtifactSyncLimit;

  beforeEach(async () => {
    mockLimit.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 10 });
    ({ checkSpatialArtifactSyncLimit } = await import("@/lib/spatial-artifacts/sync/sync-rate-limit"));
  });

  test("high priority only checks minute bucket", async () => {
    const result = await checkSpatialArtifactSyncLimit("user-1", "high");

    expect(result.success).toBe(true);
    expect(mockLimit.mock.calls.length).toBe(1);
    expect((mockLimit.mock.calls[0] as string[])[0]).toBe("user-1:high");
  });

  test("normal priority checks minute and hour buckets", async () => {
    const result = await checkSpatialArtifactSyncLimit("user-1", "normal");

    expect(result.success).toBe(true);
    expect(mockLimit.mock.calls.length).toBe(2);
  });

  test("returns error when minute limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await checkSpatialArtifactSyncLimit("user-1", "normal");

    expect(result.success).toBe(false);
    expect(result.error).toContain("minute");
  });
});
