"use client";

import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { useEffect, useRef } from "react";

import { getSessionById } from "@/data/supabase/rabbitholes";

const POLL_INTERVAL_MS = 2500;

/** Set NEXT_PUBLIC_DEBUG=1 or true in .env.local (dev only) to log each poll to the console. */
const POLL_DEBUG = typeof process !== "undefined" && process.env.NODE_ENV === "development";

/**
 * Polls for session completion when a node is generating. When the server clears
 * generating_node_id (or the node has content), calls onSessionUpdated and stops.
 * Cleanup on unmount. Swap-ready for Realtime later.
 */
export function useGenerationCompletion(
  sessionId: string | null,
  generatingNodeId: string | null,
  onSessionUpdated: (session: RabbitHoleSession) => void
): void {
  const onSessionUpdatedRef = useRef(onSessionUpdated);

  onSessionUpdatedRef.current = onSessionUpdated;

  useEffect(() => {
    if (!sessionId || !generatingNodeId) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      if (cancelled) return;
      if (POLL_DEBUG) {
        console.log(
          "[useGenerationCompletion] poll",
          sessionId,
          generatingNodeId,
          new Date().toISOString()
        );
      }
      const res = await getSessionById(sessionId);

      if (cancelled) return;
      if (res.error || !res.data) return;
      const session = res.data;
      const done =
        session.generatingNodeId === null ||
        session.generatingNodeId === undefined ||
        (session.nodesById[generatingNodeId]?.articleHtml?.length ?? 0) > 0;

      if (done) {
        onSessionUpdatedRef.current(session);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [sessionId, generatingNodeId]);
}
