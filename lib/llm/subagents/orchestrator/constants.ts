/**
 * Product target: after acknowledging and delegating, the orchestrator should
 * be free for the next user input within this window. It is not a hard kill of
 * worker jobs — workers keep running; only the orchestrator's return-to-user
 * path is timed against this budget.
 */
export const ORCHESTRATOR_RETURN_TARGET_MS = 7_000;

/** Tasks estimated above this duration must be delegated to a worker. */
export const ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS = ORCHESTRATOR_RETURN_TARGET_MS;
