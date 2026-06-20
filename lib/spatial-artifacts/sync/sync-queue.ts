export type ArtifactSyncPriority = "high" | "normal" | "low";

export type ArtifactSyncJob = {
  artifactId: string;
  ownerId: string;
  threadId: string;
  messageId: string;
  toolCallId: string;
  partIndex?: number;
  priority: ArtifactSyncPriority;
  force?: boolean;
  pin?: boolean;
  coalescenceMode: boolean;
};

const PRIORITY_RANK: Record<ArtifactSyncPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

type QueueState = {
  pending: ArtifactSyncJob[];
  ids: Set<string>;
};

function getQueueState(): QueueState {
  const g = globalThis as typeof globalThis & { __spatialArtifactSyncQueue?: QueueState };

  if (!g.__spatialArtifactSyncQueue) {
    g.__spatialArtifactSyncQueue = { pending: [], ids: new Set() };
  }

  return g.__spatialArtifactSyncQueue;
}

export function enqueueArtifactSync(job: ArtifactSyncJob): void {
  if (!job.coalescenceMode) return;

  const state = getQueueState();

  if (state.ids.has(job.artifactId)) {
    const existing = state.pending.find((j) => j.artifactId === job.artifactId);

    if (existing && PRIORITY_RANK[job.priority] < PRIORITY_RANK[existing.priority]) {
      existing.priority = job.priority;
      existing.force = existing.force || job.force;
      existing.pin = existing.pin || job.pin;
    }

    return;
  }

  state.ids.add(job.artifactId);
  state.pending.push(job);
  state.pending.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

export function dequeueArtifactSync(): ArtifactSyncJob | undefined {
  const state = getQueueState();
  const job = state.pending.shift();

  if (job) state.ids.delete(job.artifactId);

  return job;
}

export function queueLength(): number {
  return getQueueState().pending.length;
}

export function clearQueueForOwner(ownerId: string): void {
  const state = getQueueState();

  state.pending = state.pending.filter((job) => {
    if (job.ownerId === ownerId) {
      state.ids.delete(job.artifactId);

      return false;
    }

    return true;
  });
}
