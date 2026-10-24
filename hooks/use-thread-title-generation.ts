"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSharedChatContext } from "@/lib/context/chat-context";
import { createLogger } from "@/lib/logger";
import { SESSION_TITLE_NOTICE_MS } from "@/lib/sidebar/session-signal-timing";

const logger = createLogger("hooks/use-thread-title-generation.ts");

export type TitleGenerationStatus = { phase: "pending" } | { phase: "failed"; message: string };

/** Short, specific reasons — the row has one line to explain itself. */
export function titleGenerationFailureMessage(status: number | null): string {
  if (status === 429) return "Title limit reached — try later";
  if (status === 400) return "Nothing to title yet";

  return "Couldn't generate a title";
}

/**
 * AI title regeneration for sidebar rows, with the feedback the click deserves: the row shows
 * the work at once, the shared title transition applies the returned title, and a
 * failure says why for a few seconds before clearing. `announcement` is for a polite live region.
 */
export function useThreadTitleGeneration() {
  const { isTitleRegenerating, beginTitleRegen, resolveTitleRegen, finishTitleRegen } =
    useSharedChatContext();
  const [statusById, setStatusById] = useState<ReadonlyMap<string, TitleGenerationStatus>>(
    () => new Map()
  );
  const [announcement, setAnnouncement] = useState("");
  const statusRef = useRef(statusById);
  const noticeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  statusRef.current = statusById;

  useEffect(() => {
    const timers = noticeTimers.current;

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const setStatus = useCallback((threadId: string, status: TitleGenerationStatus | null) => {
    setStatusById((previous) => {
      const next = new Map(previous);

      if (status) next.set(threadId, status);
      else next.delete(threadId);

      return next;
    });
  }, []);

  const generateTitle = useCallback(
    async (thread: { id: string; title: string }) => {
      if (statusRef.current.get(thread.id)?.phase === "pending" || isTitleRegenerating(thread.id))
        return;

      clearTimeout(noticeTimers.current.get(thread.id));
      beginTitleRegen(thread.id, thread.title);
      setStatus(thread.id, { phase: "pending" });
      setAnnouncement(`Generating a new title for ${thread.title}`);

      let status: number | null = null;

      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(thread.id)}/generate-title`, {
          method: "POST",
        });

        status = res.status;
        if (!res.ok) throw new Error(`generate-title responded ${res.status}`);

        const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
        const title = typeof body?.data === "string" ? body.data.trim() : "";

        if (title) resolveTitleRegen(thread.id, title);
        else finishTitleRegen(thread.id);
        setStatus(thread.id, null);
        setAnnouncement(title ? `Title updated: ${title}` : "Title updated");
      } catch (err) {
        logger.error("generateTitle", err instanceof Error ? err.message : String(err));

        finishTitleRegen(thread.id);
        const message = titleGenerationFailureMessage(status);

        setStatus(thread.id, { phase: "failed", message });
        setAnnouncement(message);
        noticeTimers.current.set(
          thread.id,
          setTimeout(() => setStatus(thread.id, null), SESSION_TITLE_NOTICE_MS)
        );
      }
    },
    [isTitleRegenerating, beginTitleRegen, resolveTitleRegen, finishTitleRegen, setStatus]
  );

  return { titleGeneration: statusById, generateTitle, announcement };
}
