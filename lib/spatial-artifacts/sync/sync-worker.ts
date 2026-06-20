import { loadChat } from "@/data/supabase/chat";
import {
  getSpatialArtifactRow,
  upsertSpatialArtifactRow,
} from "@/data/supabase/spatial-artifacts";
import { spatialArtifactId } from "@/lib/spatial-artifacts/artifact-id";
import { isSpatialArtifactsEnabledFromRequest } from "@/lib/spatial-artifacts/coalescence-gate";
import { extractGenUIArtifactsFromMessages } from "@/lib/spatial-artifacts/extract-from-messages";
import { shouldSkipSyncDebounced } from "@/lib/spatial-artifacts/sync/sync-debounce";
import {
  dequeueArtifactSync,
  enqueueArtifactSync,
  queueLength,
  type ArtifactSyncJob,
} from "@/lib/spatial-artifacts/sync/sync-queue";
import { checkSpatialArtifactSyncLimit } from "@/lib/spatial-artifacts/sync/sync-rate-limit";
import { artifactSyncSemaphore } from "@/lib/spatial-artifacts/sync/sync-semaphore";
import { createLogger } from "@/lib/logger";

const logger = createLogger("spatial-artifacts/sync-worker");

let pumpRunning = false;

async function processSyncJob(job: ArtifactSyncJob): Promise<void> {
  if (!isSpatialArtifactsEnabledFromRequest(job.coalescenceMode)) return;

  const limit = await checkSpatialArtifactSyncLimit(job.ownerId, job.priority);

  if (!limit.success) {
    logger.warn("processSyncJob", limit.error ?? "rate limited", { artifactId: job.artifactId });

    return;
  }

  const release = await artifactSyncSemaphore.acquire();

  try {
    const existing = await getSpatialArtifactRow(job.artifactId);

    if (
      existing &&
      shouldSkipSyncDebounced(existing.snapshot_updated_at, {
        priority: job.priority,
        force: job.force,
      })
    ) {
      return;
    }

    const chatResult = await loadChat(job.threadId);

    if (chatResult.error || !chatResult.data) {
      logger.warn("processSyncJob", "failed to load thread", { threadId: job.threadId });

      return;
    }

    const { thread, messages } = chatResult.data;
    const extracted = extractGenUIArtifactsFromMessages(messages, job.threadId);
    const match =
      extracted.find((a) => a.id === job.artifactId) ??
      extracted.find(
        (a) =>
          a.messageId === job.messageId &&
          (job.toolCallId ? a.toolCallId === job.toolCallId : true)
      );

    if (!match) {
      logger.warn("processSyncJob", "artifact not found in messages", {
        artifactId: job.artifactId,
      });

      return;
    }

    const threadTitle =
      existing?.thread_title ??
      (thread.title?.trim() ? String(thread.title) : "Untitled chat");

    await upsertSpatialArtifactRow({
      id: match.id,
      owner_id: job.ownerId,
      thread_id: job.threadId,
      message_id: job.messageId,
      tool_call_id: job.toolCallId || match.toolCallId,
      block_type: match.blockType,
      thread_title: threadTitle,
      block_snapshot: match.block,
      snapshot_updated_at: new Date().toISOString(),
      source_message_updated_at: new Date().toISOString(),
      pinned: job.pin === true || existing?.pinned === true,
      pinned_at:
        job.pin === true ? new Date().toISOString() : (existing?.pinned_at ?? null),
    });
  } finally {
    release();
  }
}

async function pumpQueue(): Promise<void> {
  if (pumpRunning) return;
  pumpRunning = true;

  try {
    while (queueLength() > 0) {
      const job = dequeueArtifactSync();

      if (!job) break;

      try {
        await processSyncJob(job);
      } catch (err) {
        logger.error("pumpQueue", "job failed", { err, artifactId: job.artifactId });
      }
    }
  } finally {
    pumpRunning = false;
  }
}

export function scheduleArtifactSyncPump(): void {
  void pumpQueue();
}

export function enqueueArtifactSyncFromChat(params: {
  ownerId: string;
  threadId: string;
  coalescenceMode: boolean;
  messages: Parameters<typeof extractGenUIArtifactsFromMessages>[0];
}): void {
  if (!isSpatialArtifactsEnabledFromRequest(params.coalescenceMode)) return;

  const extracted = extractGenUIArtifactsFromMessages(params.messages, params.threadId);

  for (const artifact of extracted) {
    enqueueArtifactSync({
      artifactId: artifact.id,
      ownerId: params.ownerId,
      threadId: params.threadId,
      messageId: artifact.messageId,
      toolCallId: artifact.toolCallId,
      partIndex: artifact.partIndex,
      priority: "normal",
      coalescenceMode: params.coalescenceMode,
    });
  }

  scheduleArtifactSyncPump();
}

export async function enqueueBulkArtifactSync(params: {
  ownerId: string;
  coalescenceMode: boolean;
  maxThreads?: number;
}): Promise<void> {
  if (!isSpatialArtifactsEnabledFromRequest(params.coalescenceMode)) return;

  const { getChats } = await import("@/data/supabase/chat");
  const chatsResult = await getChats({ ownerId: params.ownerId });

  if (chatsResult.error || !chatsResult.data) return;

  const threads = chatsResult.data.slice(0, params.maxThreads ?? 30);

  for (const thread of threads) {
    const chatResult = await loadChat(thread.id);

    if (chatResult.error || !chatResult.data) continue;

    for (const artifact of extractGenUIArtifactsFromMessages(
      chatResult.data.messages,
      thread.id
    )) {
      enqueueArtifactSync({
        artifactId: artifact.id,
        ownerId: params.ownerId,
        threadId: thread.id,
        messageId: artifact.messageId,
        toolCallId: artifact.toolCallId,
        partIndex: artifact.partIndex,
        priority: "low",
        coalescenceMode: params.coalescenceMode,
      });
    }
  }

  scheduleArtifactSyncPump();
}

export { enqueueArtifactSync, type ArtifactSyncJob };

export function buildArtifactIdFromJob(job: {
  threadId: string;
  messageId: string;
  toolCallId: string;
  partIndex?: number;
}): string {
  return spatialArtifactId({
    threadId: job.threadId,
    messageId: job.messageId,
    toolCallId: job.toolCallId,
    partIndex: job.partIndex ?? 0,
  });
}
