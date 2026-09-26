/**
 * Pure dispatch readiness checks for the multi-mode message queue.
 * Kept free of I/O so unit tests can cover gating without Supabase/Redis.
 */

export type DispatchGateResult =
  | { ok: true }
  | { ok: false; status: "blocked_streaming" | "blocked_budget"; holdReason: string };

export function evaluateDispatchGates(args: {
  /** threads.active_stream_id — non-null means the agent is still streaming. */
  activeStreamId: string | null | undefined;
  /** From plan budget evaluation. */
  canDispatchBudget: boolean;
  budgetHoldReason: string | null;
}): DispatchGateResult {
  if (args.activeStreamId) {
    return {
      ok: false,
      status: "blocked_streaming",
      holdReason: "Agent is still processing a response",
    };
  }

  if (!args.canDispatchBudget) {
    return {
      ok: false,
      status: "blocked_budget",
      holdReason: args.budgetHoldReason ?? "Plan budget exhausted",
    };
  }

  return { ok: true };
}

/**
 * Whether the composer should enqueue (multi mode) instead of calling sendMessage.
 * Always true when queueSendMode is on — the server decides when to send.
 */
export function shouldEnqueueInsteadOfSend(queueSendMode: boolean): boolean {
  return queueSendMode === true;
}
