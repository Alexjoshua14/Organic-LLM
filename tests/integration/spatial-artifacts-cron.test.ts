import type { SpatialArtifactCronDeps } from "@/lib/spatial-artifacts/sync/cron-sync-handler";
import type { ArtifactSyncJob } from "@/lib/spatial-artifacts/sync/sync-worker";

import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { runSpatialArtifactSyncCron } from "@/lib/spatial-artifacts/sync/cron-sync-handler";

import { resetSpatialArtifactSyncQueue } from "../helpers/spatial-artifacts-sync-queue";

type StaleRow = {
  id: string;
  owner_id: string;
  thread_id: string;
  message_id: string;
  tool_call_id: string;
};

const mockListStaleSpatialArtifactRows = mock(async () => [] as StaleRow[]);
const mockEnqueueArtifactSync = mock((_job: ArtifactSyncJob) => undefined);
const mockScheduleArtifactSyncPump = mock(() => undefined);

/**
 * Injected rather than registered with `mock.module`. Bun applies module mocks process-wide,
 * so stubbing the sync worker or the artifact data layer here leaked into
 * `tests/integration/spatial-artifacts-sync-worker.test.ts` and failed it on CI.
 */
const deps = {
  listStaleSpatialArtifactRows: mockListStaleSpatialArtifactRows,
  enqueueArtifactSync: mockEnqueueArtifactSync,
  scheduleArtifactSyncPump: mockScheduleArtifactSyncPump,
} as unknown as SpatialArtifactCronDeps;

function cronRequest(headers?: HeadersInit): Request {
  return new Request("http://localhost/api/cron/sync-spatial-artifacts", { headers });
}

describe("GET /api/cron/sync-spatial-artifacts", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    resetSpatialArtifactSyncQueue();
    mockListStaleSpatialArtifactRows.mockClear();
    mockEnqueueArtifactSync.mockClear();
    mockScheduleArtifactSyncPump.mockClear();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  test("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const res = await runSpatialArtifactSyncCron(cronRequest(), deps);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toContain("CRON_SECRET");
  });

  test("returns 401 when authorization header is wrong", async () => {
    const res = await runSpatialArtifactSyncCron(
      cronRequest({ authorization: "Bearer wrong" }),
      deps
    );

    expect(res.status).toBe(401);
    expect(mockListStaleSpatialArtifactRows).not.toHaveBeenCalled();
  });

  test("queues stale rows and schedules pump", async () => {
    mockListStaleSpatialArtifactRows.mockResolvedValueOnce([
      {
        id: "thread-1:call_1",
        owner_id: "owner-1",
        thread_id: "thread-1",
        message_id: "msg-1",
        tool_call_id: "call_1",
      },
    ]);

    const res = await runSpatialArtifactSyncCron(
      cronRequest({ authorization: "Bearer test-cron-secret" }),
      deps
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, queued: 1 });
    expect(mockEnqueueArtifactSync).toHaveBeenCalledTimes(1);
    expect(mockScheduleArtifactSyncPump).toHaveBeenCalledTimes(1);

    const job = mockEnqueueArtifactSync.mock.calls[0]?.[0] as ArtifactSyncJob;

    expect(job.priority).toBe("low");
    expect(job.force).toBe(true);
    expect(job.coalescenceMode).toBe(true);
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });
});
