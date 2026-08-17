"use client";

import type { DrawerChatDisplayInput } from "@/lib/rabbit-holes/drawer-chat-ui-budget";

import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";

import { useRabbitHoleSessionChat } from "@/hooks/use-rabbit-hole-session-chat";
import type { SimpleResult } from "@/types";

type EnsureSessionResult = SimpleResult & { sessionId?: string };

export type UseRabbitHoleChatComposerOptions = {
  sessionId: string | null;
  drawerDisplayRef?: React.RefObject<DrawerChatDisplayInput | null>;
  onNavigate?: (activeNodeId: string) => void;
  ensureEmptySession: () => Promise<EnsureSessionResult>;
  onSessionCreated?: (sessionId: string) => void;
};

export function useRabbitHoleChatComposer({
  sessionId,
  drawerDisplayRef,
  onNavigate,
  ensureEmptySession,
  onSessionCreated,
}: UseRabbitHoleChatComposerOptions) {
  const sessionChat = useRabbitHoleSessionChat({
    sessionId,
    drawerDisplayRef,
    onNavigate,
  });

  const pendingMessageRef = useRef<Parameters<ReturnType<typeof useChat>["sendMessage"]>[0] | null>(
    null
  );
  const ensuringRef = useRef(false);

  const sendChatMessage: ReturnType<typeof useChat>["sendMessage"] = useCallback(
    async (message) => {
      if (sessionId) {
        return sessionChat.sendMessage(message);
      }

      if (ensuringRef.current) {
        pendingMessageRef.current = message;

        return undefined as unknown as ReturnType<ReturnType<typeof useChat>["sendMessage"]>;
      }

      ensuringRef.current = true;

      try {
        const ensured = await ensureEmptySession();

        if (!ensured.ok || !ensured.sessionId) {
          return undefined as unknown as ReturnType<ReturnType<typeof useChat>["sendMessage"]>;
        }

        onSessionCreated?.(ensured.sessionId);
        pendingMessageRef.current = message;
      } finally {
        ensuringRef.current = false;
      }

      return undefined as unknown as ReturnType<ReturnType<typeof useChat>["sendMessage"]>;
    },
    [ensureEmptySession, onSessionCreated, sessionChat, sessionId]
  );

  useEffect(() => {
    const pending = pendingMessageRef.current;

    if (!sessionId || !sessionChat.threadId || !pending || sessionChat.bootstrapping) {
      return;
    }

    pendingMessageRef.current = null;

    void sessionChat.sendMessage(pending);
  }, [
    sessionChat.bootstrapping,
    sessionChat.sendMessage,
    sessionChat.threadId,
    sessionId,
  ]);

  const sendChatText = useCallback(
    async (text: string) => {
      await sendChatMessage({ text });
    },
    [sendChatMessage]
  );

  return {
    ...sessionChat,
    sendChatMessage,
    sendChatText,
  };
}
