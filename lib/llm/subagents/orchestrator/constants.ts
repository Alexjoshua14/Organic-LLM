/**
 * Product target: after acknowledging and delegating, the orchestrator should
 * be free for the next user input within this window. It is not a hard kill of
 * worker jobs — workers keep running; only the orchestrator's return-to-user
 * path is timed against this budget.
 */
export const ORCHESTRATOR_RETURN_TARGET_MS = 7_000;

/** Tasks estimated above this duration must be delegated to a worker. */
export const ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS = ORCHESTRATOR_RETURN_TARGET_MS;

/** Most subagent dispatches one orchestrator turn may make by default (COA-258). */
export const ORCHESTRATOR_MAX_DISPATCHES_PER_TURN = 2;

/** Parallel specialist dispatch ceiling when self-managed budget ledger / Rabbit Hole mesh is active. */
export const ORCHESTRATOR_MAX_PARALLEL_DISPATCHES_PER_TURN = 4;

/** Default parallel dispatch ceiling inside Rabbit Hole exploration sessions. */
export const RABBIT_HOLE_MAX_DISPATCHES_PER_TURN = 4;

/**
 * Most dispatches automatic (heartbeat) turns may make between real user messages. Bounds the
 * heartbeat → reply → dispatch → heartbeat loop while the user is not steering. Sized for a
 * user-requested multi-round run (about ten rounds across a few subagents); the spend ceiling
 * below is the primary brake, this is the backstop if spend can't be read.
 */
export const ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES = 30;

/** Default USD ceiling on spend during one stretch of automatic turns (see below). */
export const ORCHESTRATOR_AUTONOMOUS_SPEND_LIMIT_USD = 3;

/**
 * Billed spend, owner-wide, allowed from the first automatic turn until the user speaks again.
 * Owner-wide over-counts when other threads are busy, which only stops earlier. Override with
 * `ARCADIA_AUTONOMOUS_SPEND_LIMIT_USD`; invalid values fall back to the default.
 */
export function getAutonomousSpendLimitUsd(): number {
  const raw = Number(process.env.ARCADIA_AUTONOMOUS_SPEND_LIMIT_USD);

  return Number.isFinite(raw) && raw > 0 ? raw : ORCHESTRATOR_AUTONOMOUS_SPEND_LIMIT_USD;
}

/**
 * Kill switch for orchestrator-authored dispatch. On unless
 * `ARCADIA_ORCHESTRATOR_DISPATCH_ENABLED=false`; off restores Jev router auto-dispatch, which
 * forwards the user's words to subagents verbatim.
 */
export function isOrchestratorDispatchEnabled(): boolean {
  return process.env.ARCADIA_ORCHESTRATOR_DISPATCH_ENABLED !== "false";
}
