import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";

import { resetSpatialArtifactSyncQueue } from "../helpers/spatial-artifacts-sync-queue";

import { FIXTURE_PLAN_TIMELINE } from "@/lib/schemas/gen-ui/fixtures";

const mockLoadChat = mock(async () => ({
  data: null as {
    thread: { id: string; title?: string | null };
    messages: UIMessage[];
  } | null,
  error: null as string | null,
}));
const mockGetChats = mock(async () => ({
  data: [] as { id: string }[],
  error: null as string | null,
}));
const mockGetSpatialArtifactRow = mock(async () => null as {
  snapshot_updated_at: string | null;
  thread_title: string | null;
  pinned: boolean;
  pinned_at: string | null;
} | null);
const mockUpsertSpatialArtifactRow = mock(async () => undefined);

mock.module("@/data/supabase/chat", () => ({
  ...globalThis.__realChat,
  loadChat: mockLoadChat,
  getChats: mockGetChats,
}));

mock.module("@/data/supabase/spatial-artifacts", () => ({
  getSpatialArtifactRow: mockGetSpatialArtifactRow,
  upsertSpatialArtifactRow: mockUpsertSpatialArtifactRow,
}));

import {
  enqueueArtifactSyncFromChat,
  enqueueBulkArtifactSync,
} from "@/lib/spatial-artifacts/sync/sync-worker";

const THREAD_ID = "22222222-2222-4222-8222-222222222222";

function assistantMessage(toolCallId: string, messageId?: string): UIMessage {
  return {
    id: messageId ?? `msg-${toolCallId}`,
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId,
        state: "output-available",
        output: { block: FIXTURE_PLAN_TIMELINE },
      } as UIMessage["parts"][number],
    ],
  } as UIMessage;
}

describe("sync-worker integration", () => {
  beforeEach(() => {
    resetSpatialArtifactSyncQueue();
    mockLoadChat.mockClear();
    mockGetChats.mockClear();
    mockGetSpatialArtifactRow.mockClear();
    mockUpsertSpatialArtifactRow.mockClear();

    mockGetSpatialArtifactRow.mockResolvedValue(null);
    mockLoadChat.mockResolvedValue({
      data: {
        thread: { id: THREAD_ID, title: "Default" },
        messages: [assistantMessage("call_default")],
      },
      error: null,
    });
  });

  test("enqueueArtifactSyncFromChat no-ops when coalescence is off", () => {
    enqueueArtifactSyncFromChat({
      ownerId: "owner-1",
      threadId: THREAD_ID,
      coalescenceMode: false,
      messages: [assistantMessage("call_1")],
    });

    expect(mockUpsertSpatialArtifactRow).not.toHaveBeenCalled();
  });

  test("enqueueArtifactSyncFromChat queues extracted artifacts", async () => {
    const messages = [assistantMessage("call_1"), assistantMessage("call_2")];

    mockLoadChat.mockResolvedValue({
      data: {
        thread: { id: THREAD_ID, title: "Multi" },
        messages,
      },
      error: null,
    });

    enqueueArtifactSyncFromChat({
      ownerId: "owner-1",
      threadId: THREAD_ID,
      coalescenceMode: true,
      messages,
    });

    await new Promise((r) => setTimeout(r, 150));

    expect(mockUpsertSpatialArtifactRow.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("processes sync job and upserts snapshot from loaded chat", async () => {
    mockGetSpatialArtifactRow.mockResolvedValueOnce(null);
    mockLoadChat.mockResolvedValueOnce({
      data: {
        thread: { id: THREAD_ID, title: "Sync title" },
        messages: [assistantMessage("call_sync")],
      },
      error: null,
    });

    enqueueArtifactSyncFromChat({
      ownerId: "owner-1",
      threadId: THREAD_ID,
      coalescenceMode: true,
      messages: [assistantMessage("call_sync")],
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(mockUpsertSpatialArtifactRow).toHaveBeenCalled();
    const upsertArg = mockUpsertSpatialArtifactRow.mock.calls[0]?.[0] as {
      id: string;
      thread_title: string;
      block_type: string;
    };

    expect(upsertArg.id).toBe(`${THREAD_ID}:call_sync`);
    expect(upsertArg.thread_title).toBe("Sync title");
    expect(upsertArg.block_type).toBe("plan-timeline");
  });

  test("enqueueBulkArtifactSync walks recent threads", async () => {
    mockGetChats.mockResolvedValue({
      data: [{ id: THREAD_ID }],
      error: null,
    });
    mockLoadChat.mockResolvedValue({
      data: {
        thread: { id: THREAD_ID, title: "Bulk" },
        messages: [assistantMessage("call_bulk")],
      },
      error: null,
    });
    mockGetSpatialArtifactRow.mockResolvedValue(null);

    await enqueueBulkArtifactSync({
      ownerId: "owner-1",
      coalescenceMode: true,
      maxThreads: 1,
    });

    await new Promise((r) => setTimeout(r, 150));

    expect(mockGetChats).toHaveBeenCalled();
    expect(mockLoadChat).toHaveBeenCalled();
    expect(mockUpsertSpatialArtifactRow).toHaveBeenCalled();
  });
});
