"use client";

import type { UIMessage } from "ai";
import type { ParticleFieldHandle } from "../_components/ParticleField";
import type { MemoryIngestFsmState, ParticleFieldVisualState } from "../_lib/types";
import type { ChatModel } from "@/lib/schemas/chat";

import type { DelphiDisplayInput } from "@/lib/memory-ingest/delphi-caption-budget";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  initialMemoryIngestFsmState,
  mapChatStatusToIngestEvent,
  mapDataAiActionToIngestEvent,
  memoryIngestReducer,
} from "../_lib/memory-ingest-fsm";

import { classifyTaskTier } from "@/lib/llm/auto-model-router";
import { getChatModel } from "@/lib/llm/helpers";
import { AUTO_CHAT_MODEL } from "@/lib/schemas/chat";
import { getSettings } from "@/lib/user-settings";

export type UseMemoryIngestSessionParams = {
  chatId: string;
  initialMessages: UIMessage[];
  delphiDisplayRef?: React.RefObject<DelphiDisplayInput | null>;
};

export function useMemoryIngestSession({
  chatId,
  initialMessages,
  delphiDisplayRef,
}: UseMemoryIngestSessionParams) {
  const [fsm, dispatch] = useReducer(memoryIngestReducer, initialMemoryIngestFsmState);
  const particleRef = useRef<ParticleFieldHandle>(null);
  const modelRef = useRef<ChatModel>(getChatModel(AUTO_CHAT_MODEL));
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(true);
  const receiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReceiptTimer = useCallback(() => {
    if (receiptTimerRef.current) {
      clearTimeout(receiptTimerRef.current);
      receiptTimerRef.current = null;
    }
  }, []);

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    resume: true,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];

        return {
          body: {
            message: lastMessage,
            id,
            model: modelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            messageSearch: true,
            knowledgeSearch: false,
            experience: "Delphi",
            zeroDataRetention: getSettings().zeroDataRetention,
            ...(delphiDisplayRef?.current ? { delphiDisplay: delphiDisplayRef.current } : {}),
          },
        };
      },
    }),
    onData: (data) => {
      const ev = mapDataAiActionToIngestEvent(data);

      if (ev) dispatch(ev);
    },
    onFinish: () => {
      dispatch({ type: "FINISH", memoryEnabled: useMemoriesRef.current });
      clearReceiptTimer();
      receiptTimerRef.current = setTimeout(() => {
        dispatch({ type: "RECEIPT_DONE" });
        receiptTimerRef.current = null;
      }, 1200);
    },
    onError: () => {
      clearReceiptTimer();
      dispatch({ type: "ERROR" });
    },
  });

  useEffect(() => {
    const ev = mapChatStatusToIngestEvent(status);

    if (ev) dispatch(ev);
  }, [status]);

  useEffect(() => {
    if (fsm.visual === "writing_memory") {
      particleRef.current?.pulseWritingMemory();
    }
  }, [fsm.visual]);

  useEffect(() => () => clearReceiptTimer(), [clearReceiptTimer]);

  const sendIngest = useCallback(
    async (text: string) => {
      const tier = classifyTaskTier(text);

      dispatch({ type: "SUBMIT", tier });
      await sendMessage({ text });
    },
    [sendMessage]
  );

  const setDraftListening = useCallback((hasText: boolean) => {
    dispatch({ type: "DRAFT", hasText });
  }, []);

  const debugSetVisual = useCallback((visual: ParticleFieldVisualState, intensity?: number) => {
    dispatch({ type: "DEBUG_SET", visual, intensity });
  }, []);

  const debugPulseWriting = useCallback(() => {
    particleRef.current?.pulseWritingMemory();
  }, []);

  return {
    fsm,
    messages,
    particleRef,
    modelRef,
    useWebSearchRef,
    useMemoriesRef,
    sendIngest,
    setDraftListening,
    status,
    stop,
    error,
    clearError,
    debugSetVisual,
    debugPulseWriting,
  } satisfies {
    fsm: MemoryIngestFsmState;
    messages: UIMessage[];
    particleRef: React.RefObject<ParticleFieldHandle | null>;
    modelRef: React.RefObject<ChatModel>;
    useWebSearchRef: React.RefObject<boolean>;
    useMemoriesRef: React.RefObject<boolean>;
    sendIngest: (text: string) => Promise<void>;
    setDraftListening: (hasText: boolean) => void;
    status: typeof status;
    stop: typeof stop;
    error: typeof error;
    clearError: typeof clearError;
    debugSetVisual: (visual: ParticleFieldVisualState, intensity?: number) => void;
    debugPulseWriting: () => void;
  };
}
