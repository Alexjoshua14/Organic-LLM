import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  createMockAuth,
  createMockClerkUser,
} from "../helpers/mock-auth";

import { FIXTURE_PLAN_TIMELINE } from "@/lib/schemas/gen-ui/fixtures";

const mockAuth = mock(createMockAuth());
const mockGetSupabaseUserId = mock(async () => ({
  data: "sb_user_1",
  error: null,
}));
const mockListSpatialArtifactRows = mock(async () => [] as never[]);
const mockUpsertSpatialArtifactRow = mock(async () => undefined);
const mockSetSpatialArtifactPinned = mock(async () => undefined);
const mockEnqueueArtifactSync = mock(() => undefined);
const mockEnqueueBulkArtifactSync = mock(async () => undefined);
const mockScheduleArtifactSyncPump = mock(() => undefined);

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
}));

mock.module("@/data/supabase/spatial-artifacts", () => ({
  listSpatialArtifactRows: mockListSpatialArtifactRows,
  upsertSpatialArtifactRow: mockUpsertSpatialArtifactRow,
  setSpatialArtifactPinned: mockSetSpatialArtifactPinned,
}));

mock.module("@/lib/spatial-artifacts/sync/sync-worker", () => ({
  enqueueArtifactSync: mockEnqueueArtifactSync,
  enqueueBulkArtifactSync: mockEnqueueBulkArtifactSync,
  scheduleArtifactSyncPump: mockScheduleArtifactSyncPump,
}));

import {
  actionBulkSyncSpatialArtifacts,
  actionListSpatialArtifacts,
  actionPinSpatialArtifact,
} from "@/app/actions/spatial-artifacts";

const THREAD_ID = "11111111-1111-4111-8111-111111111111";

describe("spatial-artifacts server actions", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockListSpatialArtifactRows.mockClear();
    mockUpsertSpatialArtifactRow.mockClear();
    mockSetSpatialArtifactPinned.mockClear();
    mockEnqueueArtifactSync.mockClear();
    mockEnqueueBulkArtifactSync.mockClear();
    mockScheduleArtifactSyncPump.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetSupabaseUserId.mockResolvedValue({ data: "sb_user_1", error: null });
  });

  test("actionListSpatialArtifacts returns disabled when coalescence is off", async () => {
    const result = await actionListSpatialArtifacts({ coalescenceMode: false });

    expect(result).toEqual({ disabled: true, artifacts: [] });
    expect(mockListSpatialArtifactRows).not.toHaveBeenCalled();
  });

  test("actionListSpatialArtifacts returns disabled when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const result = await actionListSpatialArtifacts({ coalescenceMode: true });

    expect(result).toEqual({ disabled: true, artifacts: [] });
  });

  test("actionListSpatialArtifacts sorts pinned first then by createdAt", async () => {
    mockListSpatialArtifactRows.mockResolvedValueOnce([
      {
        id: "t1:a",
        owner_id: "sb_user_1",
        thread_id: THREAD_ID,
        message_id: "msg-1",
        tool_call_id: "a",
        block_type: "plan-timeline",
        thread_title: "Older",
        block_snapshot: FIXTURE_PLAN_TIMELINE,
        snapshot_updated_at: null,
        source_message_updated_at: null,
        pinned: false,
        pinned_at: null,
        sync_lock_until: null,
        created_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "t1:b",
        owner_id: "sb_user_1",
        thread_id: THREAD_ID,
        message_id: "msg-2",
        tool_call_id: "b",
        block_type: "plan-timeline",
        thread_title: "Pinned",
        block_snapshot: FIXTURE_PLAN_TIMELINE,
        snapshot_updated_at: null,
        source_message_updated_at: null,
        pinned: true,
        pinned_at: "2026-01-03T00:00:00.000Z",
        sync_lock_until: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    const result = await actionListSpatialArtifacts({ coalescenceMode: true });

    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0]?.pinned).toBe(true);
    expect(result.artifacts[0]?.threadTitle).toBe("Pinned");
  });

  test("actionPinSpatialArtifact rejects when coalescence is off", async () => {
    const result = await actionPinSpatialArtifact({
      coalescenceMode: false,
      threadId: THREAD_ID,
      messageId: "msg-1",
      toolCallId: "call_1",
      block: FIXTURE_PLAN_TIMELINE,
    });

    expect(result).toEqual({ ok: false, error: "Coalescence Mode is off" });
  });

  test("actionPinSpatialArtifact upserts, pins, and enqueues high-priority sync", async () => {
    const result = await actionPinSpatialArtifact({
      coalescenceMode: true,
      threadId: THREAD_ID,
      messageId: "msg-1",
      toolCallId: "call_1",
      block: FIXTURE_PLAN_TIMELINE,
      threadTitle: "My chat",
    });

    expect(result.ok).toBe(true);
    expect(result.artifactId).toBe(`${THREAD_ID}:call_1`);
    expect(mockUpsertSpatialArtifactRow).toHaveBeenCalled();
    expect(mockSetSpatialArtifactPinned).toHaveBeenCalled();
    expect(mockEnqueueArtifactSync).toHaveBeenCalled();
    expect(mockScheduleArtifactSyncPump).toHaveBeenCalled();

    const syncArg = mockEnqueueArtifactSync.mock.calls[0]?.[0] as {
      priority: string;
      force: boolean;
      pin: boolean;
    };

    expect(syncArg.priority).toBe("high");
    expect(syncArg.force).toBe(true);
    expect(syncArg.pin).toBe(true);
  });

  test("actionBulkSyncSpatialArtifacts no-ops when coalescence is off", async () => {
    const result = await actionBulkSyncSpatialArtifacts({ coalescenceMode: false });

    expect(result).toEqual({ ok: false });
    expect(mockEnqueueBulkArtifactSync).not.toHaveBeenCalled();
  });

  test("actionBulkSyncSpatialArtifacts enqueues bulk sync for authenticated user", async () => {
    const result = await actionBulkSyncSpatialArtifacts({
      coalescenceMode: true,
      maxThreads: 5,
    });

    expect(result).toEqual({ ok: true });
    expect(mockEnqueueBulkArtifactSync).toHaveBeenCalledWith({
      ownerId: "sb_user_1",
      coalescenceMode: true,
      maxThreads: 5,
    });
  });
});
