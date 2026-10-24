"use client";

import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";
import type {
  MessageSendQueuePayload,
  MessageSendQueueRow,
} from "@/lib/schemas/message-send-queue";

import { useCallback, useEffect, useState } from "react";

type QueueApiResponse = {
  items?: MessageSendQueueRow[];
  openQueue?: MessageSendQueueRow[];
  budget?: PlanBudgetSnapshot;
  item?: MessageSendQueueRow;
  error?: string;
};

/**
 * Client helper for multi-mode message queue.
 *
 * Arcadia multitask shell integration: pass `queueSendMode` to CoreInput and/or
 * call `enqueue` from the shell composer with the target thread id.
 */
export function useMessageSendQueue(args: {
  threadId: string | undefined;
  enabled: boolean;
  pollMs?: number;
}) {
  const { threadId, enabled, pollMs = 4_000 } = args;
  const [items, setItems] = useState<MessageSendQueueRow[]>([]);
  const [budget, setBudget] = useState<PlanBudgetSnapshot | null>(null);
  const [enqueuePending, setEnqueuePending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !threadId) {
      setItems([]);

      return;
    }

    try {
      const res = await fetch(`/api/chat/queue?threadId=${encodeURIComponent(threadId)}`, {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json()) as QueueApiResponse;

      if (!res.ok) {
        setLastError(data.error ?? "Failed to load queue");

        return;
      }

      setItems(data.items ?? []);
      setBudget(data.budget ?? null);
      setLastError(null);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Failed to load queue");
    }
  }, [enabled, threadId]);

  useEffect(() => {
    if (!enabled || !threadId) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);

    return () => window.clearInterval(id);
  }, [enabled, threadId, pollMs, refresh]);

  const enqueue = useCallback(
    async (body: string, payload?: MessageSendQueuePayload, targetAgentId?: string) => {
      if (!threadId) {
        setLastError("No thread to enqueue into");

        return { ok: false as const, error: "No thread" };
      }

      setEnqueuePending(true);
      setLastError(null);

      try {
        const res = await fetch("/api/chat/queue", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            body,
            targetAgentId,
            payload,
          }),
        });
        const data = (await res.json()) as QueueApiResponse;

        if (!res.ok) {
          const error = data.error ?? "Enqueue failed";

          setLastError(error);

          return { ok: false as const, error };
        }

        setItems(data.openQueue ?? data.items ?? []);
        setBudget(data.budget ?? null);

        return { ok: true as const, item: data.item };
      } catch (err) {
        const error = err instanceof Error ? err.message : "Enqueue failed";

        setLastError(error);

        return { ok: false as const, error };
      } finally {
        setEnqueuePending(false);
      }
    },
    [threadId]
  );

  return {
    items,
    budget,
    enqueuePending,
    lastError,
    enqueue,
    refresh,
  };
}
