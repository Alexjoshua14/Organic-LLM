"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type {
  ContextBudgetEstimate,
  ContextBudgetScaffold,
  TextTokenCounter,
} from "@/lib/chat/context-budget";

import { useEffect, useMemo, useState } from "react";

import {
  composeContextBudget,
  computeNewThreadDefaultBudget,
  countContextMessages,
  mergePreservedLastTurn,
  scaffoldFromStreamBudget,
  withLastTurnSnapshot,
} from "@/lib/chat/context-budget";
import { useContextEffortSettings } from "@/hooks/use-context-effort-settings";
import { useDraftTokenCount } from "@/hooks/use-draft-token-count";
import { countTokensInBackground } from "@/lib/chat/background-token-counter";
import { runInIdleSlices } from "@/lib/idle-work";
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
   * locally with these messages — no per-keystroke server calls. Keep the array stable between
   * renders: a new array restarts the idle count.
   */
  threadMessages?: UIMessage[];
  /** Counts message and draft text off the critical path; tests inject a synchronous one. */
  countTokens?: TextTokenCounter;
};

/** Inputs whose token counts are all cached, so composing from them tokenizes only the draft. */
type CountedThread = {
  chatId: string;
  scaffold: ContextBudgetScaffold;
  threadMessages: UIMessage[];
  experience?: ChatExperience;
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
    countTokens = countTokensInBackground,
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
  // Only client compose reads it; the legacy poll counts the draft on the server.
  const debouncedDraftTokens = useDraftTokenCount(
    useClientCompose ? debouncedDraft : "",
    countTokens
  );
  const [polledBudget, setPolledBudget] = useState<ContextBudgetEstimate | null>(null);
  const [scaffold, setScaffold] = useState<ContextBudgetScaffold | null>(null);
  const [counted, setCounted] = useState<CountedThread | null>(null);

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
    setCounted(null);
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

  // Counting starts once the page is idle and runs in the background, never during render.
  // Until it finishes, the meter composes from the last counted messages, or shows the stream or
  // default budget.
  useEffect(() => {
    if (!useClientCompose || !chatId || !scaffold || !threadMessages) return;

    const next: CountedThread = { chatId, scaffold, threadMessages, experience };
    const input = {
      threadMessages,
      experience,
      contextMessageLimit: scaffold.contextMessageLimit,
    };
    const controller = new AbortController();
    const cancelIdle = runInIdleSlices(() => {
      void countContextMessages(input, countTokens, controller.signal).then(() => {
        if (!controller.signal.aborted) setCounted(next);
      });

      return true;
    });

    return () => {
      controller.abort();
      cancelIdle();
    };
  }, [chatId, countTokens, experience, scaffold, threadMessages, useClientCompose]);

  const composedBudget = useMemo(() => {
    if (!useClientCompose || !scaffold || !counted || counted.chatId !== chatId) return null;

    return composeContextBudget({
      scaffold: counted.scaffold,
      threadMessages: counted.threadMessages,
      draftText: debouncedDraft,
      draftTokens: debouncedDraftTokens,
      modelId,
      experience: counted.experience,
      zeroDataRetention: getSettings().zeroDataRetention,
    });
  }, [chatId, counted, debouncedDraft, debouncedDraftTokens, modelId, scaffold, useClientCompose]);

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
