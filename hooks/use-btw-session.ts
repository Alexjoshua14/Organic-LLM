"use client";

import type { ChatModel } from "@/lib/schemas/chat";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { messagePlainText } from "@/lib/chat/btw-context";
import { coreInputSnapshots } from "@/lib/core-input/snapshot-store";
import { getSettings } from "@/lib/user-settings";

/** Matches the route's limits: the side thread is short by design. */
const BTW_MAX_TURNS = 24;
const BTW_MAX_TURN_CHARS = 8_000;

export function toBtwTurns(messages: readonly UIMessage[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      text: messagePlainText(message).slice(0, BTW_MAX_TURN_CHARS),
    }))
    .filter((turn) => turn.text.length > 0)
    .slice(-BTW_MAX_TURNS);
}

type UseBtwSessionParams = {
  threadId: string;
  /** Read at send time, so the side thread uses whatever CoreInput shows then. */
  modelRef: React.RefObject<ChatModel>;
  effortRef: React.RefObject<ChatEffortLevel>;
  /** CoreInput's ephemeral `/btw` scope; its in-memory settings are dropped when this ends. */
  ephemeralScopeKey?: string;
};

type BtwSession = { id: string; threadId: string; ephemeralScopeKey?: string };

/**
 * One `/btw` side thread at a time per main thread. Messages live only in this hook: each
 * open starts a fresh `useChat` id. Closing, navigating to another thread, or unmounting all
 * end it the same way: stop any stream, drop the exchange, forget its CoreInput settings.
 */
export function useBtwSession({
  threadId,
  modelRef,
  effortRef,
  ephemeralScopeKey,
}: UseBtwSessionParams) {
  const [session, setSession] = useState<BtwSession | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const sessionSeq = useRef(0);
  const isOpen = session !== null && session.threadId === threadId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `/api/chat/${threadId}/btw`,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages: toBtwTurns(messages),
            model: modelRef.current,
            effort: effortRef.current,
            zeroDataRetention: getSettings().zeroDataRetention,
          },
        }),
      }),
    [threadId, modelRef, effortRef]
  );

  // Keyed by the session, not the visible thread, so a stale session can still be stopped.
  const chat = useChat({
    id: session?.id ?? `btw:${threadId}:closed`,
    transport,
  });
  const { sendMessage, stop, status } = chat;

  // `useChat` swaps its store when the id changes; send the opening question after the swap.
  useEffect(() => {
    if (!isOpen || !pendingQuestion) return;
    setPendingQuestion(null);
    void sendMessage({ text: pendingQuestion });
  }, [isOpen, pendingQuestion, sendMessage]);

  const endRef = useRef<() => void>(() => {});

  endRef.current = () => {
    if (status === "submitted" || status === "streaming") void stop();
    if (session?.ephemeralScopeKey) coreInputSnapshots.clearEphemeral(session.ephemeralScopeKey);
    setPendingQuestion(null);
    setSession(null);
  };

  const close = useCallback(() => endRef.current(), []);

  // Navigating to another thread ends the side thread opened in the previous one.
  useEffect(() => {
    if (session && session.threadId !== threadId) endRef.current();
  }, [session, threadId]);

  useEffect(() => () => endRef.current(), []);

  const open = useCallback(
    (question?: string) => {
      const trimmed = question?.trim();

      if (isOpen) {
        if (trimmed) void sendMessage({ text: trimmed });

        return;
      }
      sessionSeq.current += 1;
      setSession({ id: `btw:${threadId}:${sessionSeq.current}`, threadId, ephemeralScopeKey });
      if (trimmed) setPendingQuestion(trimmed);
    },
    [isOpen, sendMessage, threadId, ephemeralScopeKey]
  );

  return { ...chat, isOpen, sessionId: isOpen ? session.id : null, open, close };
}
