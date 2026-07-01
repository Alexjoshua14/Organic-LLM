"use client";

import { useUser } from "@clerk/nextjs";
import { ChatStatus } from "ai";
import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  clearDraft,
  isComposerDraftPersistenceEnabled,
  loadDraft,
  saveDraft,
} from "@/lib/chat/composer-draft-store";

const SAVE_DEBOUNCE_MS = 300;

function syncTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string): void {
  const el = ref.current;

  if (!el) return;

  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export type UseComposerDraftParams = {
  chatId?: string;
  text: string;
  setText: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onComposerTextChange?: (text: string) => void;
  status: ChatStatus;
  error?: unknown;
  /** True when URL seed, inject, or other sources take precedence over stored draft. */
  hasHigherPriorityHydration: () => boolean;
};

export function useComposerDraft({
  chatId,
  text,
  setText,
  textareaRef,
  onComposerTextChange,
  status,
  error,
  hasHigherPriorityHydration,
}: UseComposerDraftParams) {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [draftRestored, setDraftRestored] = useState(false);

  const textRef = useRef(text);
  const prevChatIdRef = useRef<string | undefined>(chatId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(userId);

  textRef.current = text;
  userIdRef.current = userId;

  const persistenceEnabled = isComposerDraftPersistenceEnabled();

  const flushSave = useCallback(async (targetChatId: string, value: string) => {
    if (!isComposerDraftPersistenceEnabled()) return;

    await saveDraft(targetChatId, value, userIdRef.current);
  }, []);

  const clearDraftOnSend = useCallback(() => {
    if (!chatId) return;

    void clearDraft(chatId);
    setDraftRestored(false);
  }, [chatId]);

  // Restore encrypted draft after higher-priority hydration (URL seed, inject) has run.
  useLayoutEffect(() => {
    if (!persistenceEnabled || !chatId) return;

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      if (hasHigherPriorityHydration()) return;
      if (textRef.current.trim()) return;
      if (status === "error" || error) return;

      void loadDraft(chatId, userIdRef.current).then((draft) => {
        if (cancelled || !draft?.trim()) return;
        if (hasHigherPriorityHydration()) return;
        if (textRef.current.trim()) return;

        setText(draft);
        onComposerTextChange?.(draft);
        syncTextarea(textareaRef, draft);
        setDraftRestored(true);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    chatId,
    persistenceEnabled,
    hasHigherPriorityHydration,
    onComposerTextChange,
    setText,
    status,
    error,
    textareaRef,
    userId,
  ]);

  // Debounced persist while typing.
  useEffect(() => {
    if (!persistenceEnabled || !chatId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      void flushSave(chatId, textRef.current);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [text, chatId, persistenceEnabled, flushSave]);

  // Flush outgoing thread draft when switching chats; save on unmount.
  useEffect(() => {
    const previousChatId = prevChatIdRef.current;

    if (previousChatId && previousChatId !== chatId && persistenceEnabled) {
      void flushSave(previousChatId, textRef.current);
    }

    prevChatIdRef.current = chatId;

    return () => {
      if (chatId && persistenceEnabled) {
        void flushSave(chatId, textRef.current);
      }
    };
  }, [chatId, persistenceEnabled, flushSave]);

  return {
    clearDraftOnSend,
    draftRestored,
    persistenceEnabled,
  };
}
