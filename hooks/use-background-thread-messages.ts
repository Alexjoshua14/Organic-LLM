"use client";

import type { UIMessage } from "ai";

import { useEffect, useRef } from "react";

const BACKGROUND_MESSAGES_POLL_MS = 4_000;

/** Merge persisted replies without replacing a local user turn or a live stream. */
export function useBackgroundThreadMessages(args: {
  threadId: string;
  enabled: boolean;
  status: string;
  setMessages: (updater: (messages: UIMessage[]) => UIMessage[]) => void;
}) {
  const current = useRef(args);
  current.current = args;

  useEffect(() => {
    if (!args.enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        if (document.visibilityState !== "visible" || current.current.status !== "ready") return;
        const response = await fetch(`/api/chat/${args.threadId}/arcadia/messages`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok || cancelled) return;
        const payload = await response.json() as { messages: UIMessage[] };
        if (cancelled || current.current.status !== "ready") return;
        current.current.setMessages((messages) => {
          const ids = new Set(messages.map((m) => m.id));
          const added = payload.messages.filter((m) => !ids.has(m.id));
          return added.length ? [...messages, ...added] : messages;
        });
      } catch {
        // Keep the displayed conversation during an offline interval.
      } finally {
        if (!cancelled) timer = setTimeout(poll, BACKGROUND_MESSAGES_POLL_MS);
      }
    };
    void poll();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [args.enabled, args.threadId]);
}
