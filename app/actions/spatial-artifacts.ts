"use server";

import { auth } from "@clerk/nextjs/server";

import {
  listSpatialArtifactRows,
  setSpatialArtifactPinned,
  upsertSpatialArtifactRow,
} from "@/data/supabase/spatial-artifacts";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { spatialArtifactId } from "@/lib/spatial-artifacts/artifact-id";
import { isSpatialArtifactsEnabledFromRequest } from "@/lib/spatial-artifacts/coalescence-gate";
import type {
  ListSpatialArtifactsResult,
  PinSpatialArtifactInput,
  SpatialArtifact,
} from "@/lib/schemas/spatial-artifact";
import { GenUIBlockSchema } from "@/lib/schemas/gen-ui";
import {
  enqueueArtifactSync,
  enqueueBulkArtifactSync,
  scheduleArtifactSyncPump,
} from "@/lib/spatial-artifacts/sync/sync-worker";

async function requireActor(): Promise<{ sbUserId: string } | null> {
  const clerkUser = await auth();

  if (!clerkUser?.userId) return null;

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) return null;

  return { sbUserId: sbUserIdResult.data };
}

function rowToArtifact(row: Awaited<ReturnType<typeof listSpatialArtifactRows>>[number]): SpatialArtifact | null {
  const blockParsed = GenUIBlockSchema.safeParse(row.block_snapshot);

  if (!blockParsed.success) return null;

  return {
    id: row.id,
    block: blockParsed.data,
    threadId: row.thread_id,
    threadTitle: row.thread_title,
    messageId: row.message_id,
    toolCallId: row.tool_call_id,
    blockType: row.block_type,
    createdAt: row.created_at,
    pinned: row.pinned,
    snapshotUpdatedAt: row.snapshot_updated_at,
    stale: false,
  };
}

export async function actionListSpatialArtifacts(input: {
  coalescenceMode: boolean;
}): Promise<ListSpatialArtifactsResult> {
  if (!isSpatialArtifactsEnabledFromRequest(input.coalescenceMode)) {
    return { disabled: true, artifacts: [] };
  }

  const actor = await requireActor();

  if (!actor) return { disabled: true, artifacts: [] };

  const rows = await listSpatialArtifactRows(actor.sbUserId);

  return {
    artifacts: rows
      .map(rowToArtifact)
      .filter((a): a is SpatialArtifact => a != null)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }),
  };
}

export async function actionPinSpatialArtifact(
  input: PinSpatialArtifactInput
): Promise<{ ok: boolean; artifactId?: string; error?: string }> {
  if (!isSpatialArtifactsEnabledFromRequest(input.coalescenceMode)) {
    return { ok: false, error: "Coalescence Mode is off" };
  }

  const actor = await requireActor();

  if (!actor) return { ok: false, error: "Unauthorized" };

  const artifactId = spatialArtifactId({
    threadId: input.threadId,
    messageId: input.messageId,
    toolCallId: input.toolCallId,
    partIndex: 0,
  });

  await upsertSpatialArtifactRow({
    id: artifactId,
    owner_id: actor.sbUserId,
    thread_id: input.threadId,
    message_id: input.messageId,
    tool_call_id: input.toolCallId,
    block_type: input.block.type,
    thread_title: input.threadTitle ?? "Untitled chat",
    block_snapshot: input.block,
    snapshot_updated_at: new Date().toISOString(),
    source_message_updated_at: new Date().toISOString(),
    pinned: true,
    pinned_at: new Date().toISOString(),
  });

  await setSpatialArtifactPinned({ id: artifactId, ownerId: actor.sbUserId, pinned: true });

  enqueueArtifactSync({
    artifactId,
    ownerId: actor.sbUserId,
    threadId: input.threadId,
    messageId: input.messageId,
    toolCallId: input.toolCallId,
    priority: "high",
    pin: true,
    force: true,
    coalescenceMode: input.coalescenceMode,
  });
  scheduleArtifactSyncPump();

  return { ok: true, artifactId };
}

export async function actionBulkSyncSpatialArtifacts(input: {
  coalescenceMode: boolean;
  maxThreads?: number;
}): Promise<{ ok: boolean }> {
  if (!isSpatialArtifactsEnabledFromRequest(input.coalescenceMode)) {
    return { ok: false };
  }

  const actor = await requireActor();

  if (!actor) return { ok: false };

  await enqueueBulkArtifactSync({
    ownerId: actor.sbUserId,
    coalescenceMode: input.coalescenceMode,
    maxThreads: input.maxThreads,
  });

  return { ok: true };
}
