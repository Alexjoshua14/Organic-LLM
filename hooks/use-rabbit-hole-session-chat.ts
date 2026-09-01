"use client";

import type { DrawerChatDisplayInput } from "@/lib/rabbit-holes/drawer-chat-ui-budget";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { getSettings } from "@/lib/user-settings";
import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { ChatAIActionEnum } from "@/types/ai";

export type UseRabbitHoleSessionChatOptions = {
  sessionId: string | null;
  drawerDisplayRef?: React.RefObject<DrawerChatDisplayInput | null>;
  onNavigate?: (activeNodeId: string) => void;
};

export function useRabbitHoleSessionChat({
  sessionId,
  drawerDisplayRef,
  onNavigate,
}: UseRabbitHoleSessionChatOptions) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<
    { action: ChatAIActionEnum; message?: string } | undefined
  >(undefined);

  useEffect(() => {
    if (!sessionId) {
      setThreadId(null);
      setInitialMessages([]);

      return;
    }

    let cancelled = false;

    setBootstrapping(true);
    setBootError(null);

    fetch(`/api/rabbitholes/${sessionId}/chat-thread`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };

          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        return res.json() as Promise<{
          threadId: string;
          messages: UIMessage[];
        }>;
      })
      .then((data) => {
        if (cancelled) return;

        setThreadId(data.threadId);
        setInitialMessages(data.messages ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setBootError(err instanceof Error ? err.message : "Failed to load chat thread");
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const chat = useChat({
    id: threadId ?? undefined,
    messages: initialMessages,
    resume: Boolean(threadId),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];
        const message = isClientPIIRedactionEnabled()
          ? redactUIMessages([lastMessage])[0]
          : lastMessage;

        return {
          body: {
            message,
            id,
            model: modelRef.current,
            webSearch: false,
            memory: true,
            messageSearch: false,
            experience: "rabbit_hole",
            rabbitHoleSessionId: sessionId,
            drawerDisplay: drawerDisplayRef?.current ?? undefined,
            zeroDataRetention: getSettings().zeroDataRetention,
          },
        };
      },
    }),
    onData: (data) => {
      if (data.type === "data-rabbit-hole-nav") {
        const payload = data.data as { activeNodeId?: string };

        if (payload.activeNodeId) {
          onNavigate?.(payload.activeNodeId);
        }
      } else if (data.type === "data-aiAction") {
        const payload = data.data as { action: ChatAIActionEnum; message?: string };

        setAiAction({ action: payload.action, message: payload.message });
      }
    },
  });

  const isStreaming =
    chat.status === "streaming" || chat.status === "submitted" || bootstrapping;

  const stop = useCallback(async () => {
    await chat.stop();
  }, [chat]);

  return {
    ...chat,
    threadId,
    bootstrapping,
    bootError,
    aiAction,
    isStreaming,
    modelRef,
    stop,
  };
}
