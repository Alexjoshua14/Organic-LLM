"use client";

import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";

import { useEffect, useMemo, useState } from "react";

import { computeNewThreadDefaultBudget } from "@/lib/chat/context-budget";

type UseThreadContextBudgetParams = {
  chatId?: string;
  modelId: string;
  draftText: string;
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
  messageSearchEnabled?: boolean;
  experience?: ChatExperience;
  chatStyle?: ChatStyle;
  speechFriendly?: boolean;
  /** Bump after a stream completes to refresh from the server. */
  refreshKey?: number;
  /** Authoritative snapshot from the latest stream `data-context-budget`. */
  streamBudget?: ContextBudgetEstimate | null;
  /** Debounce draft re-count while typing (ms). */
  draftDebounceMs?: number;
  /** When false, skips polling (e.g. missing chat id). */
  enabled?: boolean;
};

export function useThreadContextBudget(
  params: UseThreadContextBudgetParams
): ContextBudgetEstimate {
  const {
    chatId,
    modelId,
    draftText,
    memoryEnabled = true,
    webSearchEnabled = true,
    messageSearchEnabled = true,
    experience,
    chatStyle,
    speechFriendly,
    refreshKey = 0,
    streamBudget,
    draftDebounceMs = 400,
    enabled = true,
  } = params;

  const [debouncedDraft, setDebouncedDraft] = useState(draftText);
  const [polledBudget, setPolledBudget] = useState<ContextBudgetEstimate | null>(null);

  const defaultBudget = useMemo(
    () =>
      computeNewThreadDefaultBudget({
        modelId,
        memoryEnabled,
        webSearchEnabled,
        messageSearchEnabled,
      }),
    [memoryEnabled, messageSearchEnabled, modelId, webSearchEnabled]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDraft(draftText), draftDebounceMs);

    return () => window.clearTimeout(timer);
  }, [draftText, draftDebounceMs]);

  useEffect(() => {
    if (!chatId || !enabled) {
      setPolledBudget(null);

      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/chat/context-budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            chatId,
            draftText: debouncedDraft,
            modelId,
            memory: memoryEnabled,
            webSearch: webSearchEnabled,
            messageSearch: messageSearchEnabled,
            experience,
            chatStyle,
            speechFriendly,
          }),
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { budget?: ContextBudgetEstimate };

        if (payload.budget) {
          setPolledBudget(payload.budget);
        }
      } catch {
        /* ignore abort / transient failures */
      }
    })();

    return () => controller.abort();
  }, [
    chatId,
    chatStyle,
    debouncedDraft,
    enabled,
    experience,
    memoryEnabled,
    messageSearchEnabled,
    modelId,
    refreshKey,
    speechFriendly,
    webSearchEnabled,
  ]);

  if (!enabled || !chatId) {
    return defaultBudget;
  }

  return polledBudget ?? streamBudget ?? defaultBudget;
}
