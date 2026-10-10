/**
 * Product target: after acknowledging and delegating, the orchestrator should
 * be free for the next user input within this window. It is not a hard kill of
 * worker jobs — workers keep running; only the orchestrator's return-to-user
 * path is timed against this budget.
 */
export const ORCHESTRATOR_RETURN_TARGET_MS = 7_000;

/** Tasks estimated above this duration must be delegated to a worker. */
export const ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS = ORCHESTRATOR_RETURN_TARGET_MS;

/** Most subagent dispatches one orchestrator turn may make (COA-258). */
export const ORCHESTRATOR_MAX_DISPATCHES_PER_TURN = 4;

/**
 * Most dispatches automatic (heartbeat) turns may make between real user messages. Bounds the
 * heartbeat → reply → dispatch → heartbeat loop while the user is not steering.
 */
export const ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES = 3;

/**
 * Kill switch for orchestrator-authored dispatch. On unless
 * `ARCADIA_ORCHESTRATOR_DISPATCH_ENABLED=false`; off restores Jev router auto-dispatch, which
 * forwards the user's words to subagents verbatim.
 */
export function isOrchestratorDispatchEnabled(): boolean {
  return process.env.ARCADIA_ORCHESTRATOR_DISPATCH_ENABLED !== "false";
}
