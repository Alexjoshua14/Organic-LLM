"use client";

import type { UIMessage } from "ai";
import type { ParticleFieldHandle } from "../_components/ParticleField";
import type { CommitFailedMemory, FiledMemory } from "../_lib/memory-ingest-filed";
import type { MemoryIngestFsmState, ParticleFieldVisualState } from "../_lib/types";
import type { ChatModel } from "@/lib/schemas/chat";

import type { DelphiDisplayInput } from "@/lib/memory-ingest/delphi-caption-budget";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  appendSessionFiled,
  loadSessionFiled,
  parseMemoryCommitFailed,
  parseMemoryCommitted,
  removeSessionFiled,
  saveSessionFiled,
} from "../_lib/memory-ingest-filed";
import {
  initialMemoryIngestFsmState,
  mapChatStatusToIngestEvent,
  mapDataAiActionToIngestEvent,
  memoryIngestReducer,
} from "../_lib/memory-ingest-fsm";
import { RECEIPT_LINGER_MS } from "../_lib/memory-ingest-tuning";

import { forgetMemory } from "@/lib/chat/forget-memory";
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
  const [filed, setFiled] = useState<FiledMemory | null>(null);
  const [sessionFiled, setSessionFiled] = useState<FiledMemory[]>([]);
  const [expandedTs, setExpandedTs] = useState<number | null>(null);
  const [sessionTrayOpen, setSessionTrayOpen] = useState(false);
  const [commitFailed, setCommitFailed] = useState<CommitFailedMemory | null>(null);

  const dismissFiled = useCallback(() => setFiled(null), []);
  const dismissCommitFailed = useCallback(() => setCommitFailed(null), []);

  const persistSession = useCallback(
    (items: FiledMemory[]) => {
      saveSessionFiled(chatId, items);
    },
    [chatId]
  );

  useEffect(() => {
    setSessionFiled(loadSessionFiled(chatId));
  }, [chatId]);

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
      const committed = parseMemoryCommitted(data);

      if (committed) {
        setCommitFailed(null);
        setFiled(committed);
        setSessionFiled((prev) => {
          const next = appendSessionFiled(prev, committed);

          persistSession(next);

          return next;
        });
        setExpandedTs(null);

        return;
      }

      const failed = parseMemoryCommitFailed(data);

      if (failed) {
        setCommitFailed(failed);
        setFiled(null);
        dispatch({ type: "COMMIT_FAILED" });

        return;
      }

      const ev = mapDataAiActionToIngestEvent(data);

      if (ev) dispatch(ev);
    },
    onFinish: () => {
      dispatch({ type: "FINISH" });
      clearReceiptTimer();
      receiptTimerRef.current = setTimeout(() => {
        dispatch({ type: "RECEIPT_DONE" });
        receiptTimerRef.current = null;
      }, RECEIPT_LINGER_MS);
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

  const toggleExpanded = useCallback((ts: number) => {
    setExpandedTs((prev) => (prev === ts ? null : ts));
  }, []);

  const forgetFiled = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await forgetMemory(id);

      if (res.error) return false;

      setSessionFiled((prev) => {
        const removed = prev.find((m) => m.id === id);
        const next = removeSessionFiled(prev, id);

        persistSession(next);

        if (removed) {
          setExpandedTs((exp) => (exp === removed.ts ? null : exp));
        }

        return next;
      });
      setFiled((current) => (current?.id === id ? null : current));

      return true;
    },
    [persistSession]
  );

  const sendIngest = useCallback(
    async (text: string) => {
      const tier = classifyTaskTier(text);

      dispatch({ type: "SUBMIT", tier });
      particleRef.current?.pulseReceived();
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
    filed,
    dismissFiled,
    sessionFiled,
    expandedTs,
    toggleExpanded,
    sessionTrayOpen,
    setSessionTrayOpen,
    forgetFiled,
    commitFailed,
    dismissCommitFailed,
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
    filed: FiledMemory | null;
    dismissFiled: () => void;
    sessionFiled: FiledMemory[];
    expandedTs: number | null;
    toggleExpanded: (ts: number) => void;
    sessionTrayOpen: boolean;
    setSessionTrayOpen: React.Dispatch<React.SetStateAction<boolean>>;
    forgetFiled: (id: string) => Promise<boolean>;
    commitFailed: CommitFailedMemory | null;
    dismissCommitFailed: () => void;
  };
}
