/**
 * Async subagent run state, stored on the child thread row (`threads.subagent_status`).
 * Mirrors the Arcadia card statuses so the board can read rows directly.
 */
export const SUBAGENT_THREAD_STATUSES = ["idle", "working", "done", "blocked"] as const;

export type SubagentThreadStatus = (typeof SUBAGENT_THREAD_STATUSES)[number];

export function isSubagentThreadStatus(value: unknown): value is SubagentThreadStatus {
  return (
    typeof value === "string" && (SUBAGENT_THREAD_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Subagent runs execute in `after()` on `/api/chat`, which is capped by that route's
 * `maxDuration` (300s). Keep the two in step: a run cannot outlive this ceiling.
 */
export const SUBAGENT_RUN_MAX_DURATION_MS = 300_000;

/**
 * A `working` row older than the run ceiling plus a margin was killed mid-run (timeout, deploy,
 * crash) and will never write `done`. Read it as `blocked` so the board and heartbeat stop
 * waiting on it.
 */
export const SUBAGENT_RUN_STALE_MS = SUBAGENT_RUN_MAX_DURATION_MS + 60_000;

export function resolveEffectiveSubagentStatus(
  status: string | null | undefined,
  statusAt: string | null | undefined,
  now: number = Date.now()
): SubagentThreadStatus {
  if (!isSubagentThreadStatus(status)) return "idle";
  if (status !== "working") return status;

  const at = statusAt ? Date.parse(statusAt) : Number.NaN;

  if (!Number.isFinite(at) || now - at > SUBAGENT_RUN_STALE_MS) return "blocked";

  return "working";
}
