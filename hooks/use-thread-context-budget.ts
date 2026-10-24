"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate, ContextBudgetScaffold } from "@/lib/chat/context-budget";

import { useEffect, useMemo, useState } from "react";

import {
  composeContextBudget,
  computeNewThreadDefaultBudget,
  mergePreservedLastTurn,
  scaffoldFromStreamBudget,
  withLastTurnSnapshot,
} from "@/lib/chat/context-budget";
import { useContextEffortSettings } from "@/hooks/use-context-effort-settings";
import { contextEffortForRequest } from "@/lib/memory/context-effort";
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
  const contextEffortSettings = useContextEffortSettings();
  const contextEffort = contextEffortForRequest({
    experience,
    memoryEnabled,
    experimentalContextEffort: contextEffortSettings.enabled,
    contextEffortLevel: contextEffortSettings.level,
  });

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

  useEffect(() => {
    setScaffold(null);
    setPolledBudget(null);
  }, [chatId]);

  // Adopt measured scaffold from the stream budget when it arrives.
  useEffect(() => {
    if (!useClientCompose || !streamBudget) return;

    setScaffold(scaffoldFromStreamBudget(withLastTurnSnapshot(streamBudget)));
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
            ...(contextEffort ? { contextEffort } : {}),
          }),
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { scaffold?: ContextBudgetScaffold };

        const incomingScaffold = payload.scaffold;

        if (incomingScaffold) {
          setScaffold((previous) => mergePreservedLastTurn(incomingScaffold, previous));
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
    contextEffort,
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
            ...(contextEffort ? { contextEffort } : {}),
          }),
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { budget?: ContextBudgetEstimate };

        const incomingBudget = payload.budget;

        if (incomingBudget) {
          setPolledBudget((previous) => mergePreservedLastTurn(incomingBudget, previous));
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
    contextEffort,
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
    const next = composedBudget
      ? mergePreservedLastTurn(composedBudget, streamBudget)
      : streamBudget;

    return next ?? defaultBudget;
  }

  const next = polledBudget ? mergePreservedLastTurn(polledBudget, streamBudget) : streamBudget;

  return next ?? defaultBudget;
}
