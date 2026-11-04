import "server-only";

import type { ActiveStreamMarker } from "@/data/supabase/active-streams";

import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/stale-stream-sweep.ts");

/**
 * How long a thread must sit untouched with a stream marker before the sweep asks Redis whether
 * that stream is still live. Chat turns finish in seconds to a few minutes, so 15 minutes of
 * silence is well past any normal stream while still unsticking a user within a cron interval.
 * The Redis check, not this threshold, is what decides: a live stream is never cleared.
 */
export const STALE_STREAM_IDLE_MS = 15 * 60_000;

/** Markers inspected per run. Stuck markers are rare; this only bounds a bad day. */
export const STALE_STREAM_SWEEP_BATCH = 200;

/** `resumable-stream`'s answer: no such stream, still producing, or finished. */
export type StreamLiveness = null | true | "DONE";

export type StaleStreamSweepDeps = {
  listIdle: (idleBefore: Date, limit: number) => Promise<ActiveStreamMarker[]>;
  streamStatus: (streamId: string) => Promise<StreamLiveness>;
  clear: (threadId: string, streamId: string) => Promise<boolean>;
};

export type StaleStreamSweepReport = {
  /** Idle markers inspected. */
  checked: number;
  /** Markers cleared: Redis had no live stream for them. */
  cleared: number;
  /** Still streaming in Redis despite the idle row; left alone. */
  live: number;
  /** The thread got a different marker (or none) between read and clear; left alone. */
  changed: number;
  /** Liveness or clear failed; left alone and retried next run. */
  failed: number;
};

/**
 * Clears `threads.active_stream_id` markers left behind by streams that died without finishing:
 * a server killed mid-stream, a crashed deploy, a failed final save. A stuck marker counts
 * against the owner's simultaneous-stream cap forever and points resume at a dead stream.
 *
 * A marker is cleared only when all three hold:
 * 1. the thread row has been idle for {@link STALE_STREAM_IDLE_MS};
 * 2. Redis reports no live stream under that id (missing, expired, or done);
 * 3. the row still carries the same id when cleared (compare-and-set).
 *
 * When liveness cannot be checked, nothing is cleared. See `docs/thread-session-architecture.md`.
 */
export async function sweepStaleActiveStreams(
  options: { now?: Date; deps?: StaleStreamSweepDeps } = {}
): Promise<StaleStreamSweepReport> {
  const now = options.now ?? new Date();
  const deps = options.deps ?? (await defaultDeps());
  const idleBefore = new Date(now.getTime() - STALE_STREAM_IDLE_MS);
  const markers = await deps.listIdle(idleBefore, STALE_STREAM_SWEEP_BATCH);
  const report: StaleStreamSweepReport = {
    checked: markers.length,
    cleared: 0,
    live: 0,
    changed: 0,
    failed: 0,
  };

  for (const marker of markers) {
    try {
      if ((await deps.streamStatus(marker.streamId)) === true) {
        report.live += 1;
        continue;
      }

      if (await deps.clear(marker.threadId, marker.streamId)) {
        report.cleared += 1;
      } else {
        report.changed += 1;
      }
    } catch (error) {
      report.failed += 1;
      logger.warn("sweepStaleActiveStreams", "Could not check or clear a stream marker", {
        threadId: marker.threadId,
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return report;
}

/** Real data layer and Redis, loaded lazily so tests never touch either. */
async function defaultDeps(): Promise<StaleStreamSweepDeps> {
  const [
    { listIdleActiveStreams, clearActiveStreamIfUnchanged },
    { createChatResumableStreamContext },
  ] = await Promise.all([
    import("@/data/supabase/active-streams"),
    import("@/lib/chat/resumable-sse-stream"),
  ]);
  let context: ReturnType<typeof createChatResumableStreamContext> | null = null;

  return {
    listIdle: listIdleActiveStreams,
    // Throws without REDIS_URL, which the loop records as a failure rather than clearing blind.
    streamStatus: async (streamId) =>
      (await (context ??= createChatResumableStreamContext())).hasExistingStream(streamId),
    clear: clearActiveStreamIfUnchanged,
  };
}
