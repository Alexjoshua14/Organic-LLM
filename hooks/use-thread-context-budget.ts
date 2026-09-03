"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate, ContextBudgetScaffold } from "@/lib/chat/context-budget";

import { useEffect, useMemo, useState } from "react";

import {
  composeContextBudget,
  computeNewThreadDefaultBudget,
  scaffoldFromStreamBudget,
} from "@/lib/chat/context-budget";
import { getSettings } from "@/lib/user-settings";

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
  /**
   * When present, fetch a numbers-only scaffold on open/toggles/refresh and compose
   * locally with these messages — no per-keystroke server calls.
   */
  threadMessages?: UIMessage[];
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
    threadMessages,
  } = params;

  const useClientCompose = threadMessages != null;

  const [debouncedDraft, setDebouncedDraft] = useState(draftText);
  const [polledBudget, setPolledBudget] = useState<ContextBudgetEstimate | null>(null);
  const [scaffold, setScaffold] = useState<ContextBudgetScaffold | null>(null);

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

  // Adopt measured scaffold from the stream budget when it arrives.
  useEffect(() => {
    if (!useClientCompose || !streamBudget) return;

    setScaffold(scaffoldFromStreamBudget(streamBudget));
  }, [streamBudget, useClientCompose]);

  // Client-compose path: fetch scaffold on open / toggle / refresh — not on draft change.
  useEffect(() => {
    if (!useClientCompose || !chatId || !enabled) {
      if (useClientCompose) setScaffold(null);

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
            modelId,
            mode: "scaffold",
            memory: memoryEnabled,
            webSearch: webSearchEnabled,
            messageSearch: messageSearchEnabled,
            experience,
            chatStyle,
            speechFriendly,
            zeroDataRetention: getSettings().zeroDataRetention,
          }),
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { scaffold?: ContextBudgetScaffold };

        if (payload.scaffold) {
          setScaffold(payload.scaffold);
        }
      } catch {
        /* ignore abort / transient failures */
      }
    })();

    return () => controller.abort();
  }, [
    chatId,
    chatStyle,
    enabled,
    experience,
    memoryEnabled,
    messageSearchEnabled,
    modelId,
    refreshKey,
    speechFriendly,
    useClientCompose,
    webSearchEnabled,
  ]);

  // Legacy poll path when threadMessages are not supplied.
  useEffect(() => {
    if (useClientCompose || !chatId || !enabled) {
      if (!useClientCompose) setPolledBudget(null);

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
            mode: "budget",
            memory: memoryEnabled,
            webSearch: webSearchEnabled,
            messageSearch: messageSearchEnabled,
            experience,
            chatStyle,
            speechFriendly,
            zeroDataRetention: getSettings().zeroDataRetention,
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
    useClientCompose,
    webSearchEnabled,
  ]);

  const composedBudget = useMemo(() => {
    if (!useClientCompose || !scaffold || !threadMessages) return null;

    return composeContextBudget({
      scaffold,
      threadMessages,
      draftText: debouncedDraft,
      modelId,
      experience,
      zeroDataRetention: getSettings().zeroDataRetention,
    });
  }, [debouncedDraft, experience, modelId, scaffold, threadMessages, useClientCompose]);

  if (!enabled || !chatId) {
    return defaultBudget;
  }

  if (useClientCompose) {
    return composedBudget ?? streamBudget ?? defaultBudget;
  }

  return polledBudget ?? streamBudget ?? defaultBudget;
}
