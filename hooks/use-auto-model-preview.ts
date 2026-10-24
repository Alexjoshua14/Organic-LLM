"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  evaluateAutoModelChangeGateSync,
  isAutoModelSelectorId,
  routeAutoModel,
  type AutoModelRouteDecision,
  type UserComposerActivityState,
} from "@/lib/llm/auto-model-router";

/** Pause duration after keystrokes before transitioning `typing` → `thinking`. */
export const AUTO_MODEL_THINKING_PAUSE_MS = 900;

/** Inactivity duration before transitioning to `idle`. */
export const AUTO_MODEL_IDLE_TIMEOUT_MS = 6000;

/** Debounce window before calling `POST /api/chat/auto-model` on material changes. */
export const AUTO_MODEL_NETWORK_DEBOUNCE_MS = 420;

export interface ResolveActivityStateParams {
  isOnline: boolean;
  hasText: boolean;
  msSinceLastKeystroke: number | null;
  msSinceLastSelectionMove: number | null;
  msSinceLastInteraction: number | null;
}

/**
 * Pure deterministic resolver for composer activity state.
 */
export function resolveComposerActivityState(
  params: ResolveActivityStateParams
): UserComposerActivityState {
  if (!params.isOnline) {
    return "disconnected";
  }

  if (!params.hasText) {
    return "idle";
  }

  if (
    params.msSinceLastInteraction !== null &&
    params.msSinceLastInteraction >= AUTO_MODEL_IDLE_TIMEOUT_MS
  ) {
    return "idle";
  }

  if (
    params.msSinceLastKeystroke !== null &&
    params.msSinceLastKeystroke < AUTO_MODEL_THINKING_PAUSE_MS
  ) {
    return "typing";
  }

  if (
    params.msSinceLastSelectionMove !== null &&
    params.msSinceLastKeystroke !== null &&
    params.msSinceLastSelectionMove < params.msSinceLastKeystroke &&
    params.msSinceLastKeystroke >= AUTO_MODEL_THINKING_PAUSE_MS
  ) {
    return "reviewing";
  }

  if (
    params.msSinceLastKeystroke !== null &&
    params.msSinceLastKeystroke >= AUTO_MODEL_THINKING_PAUSE_MS
  ) {
    return "thinking";
  }

  return "idle";
}

/**
 * Pure client-safe synchronous preview of the Auto-model routing decision.
 */
export function previewAutoModelClientSync(params: {
  text: string;
  previousText?: string;
  previousModelId?: string;
  activityState?: UserComposerActivityState;
  experience?: string;
  webSearch?: boolean;
  memory?: boolean;
}): AutoModelRouteDecision {
  return routeAutoModel({
    text: params.text,
    previousText: params.previousText,
    previousModelId: params.previousModelId,
    activityState: params.activityState ?? "typing",
    experience: params.experience,
    webSearch: params.webSearch,
    memory: params.memory,
  });
}

export interface UseAutoModelPreviewOptions {
  selectedModelId: string;
  text: string;
  experience?: string;
  webSearch?: boolean;
  memory?: boolean;
  /** Disable background POST in unit tests or offline sandboxes when desired. */
  enableNetworkPreview?: boolean;
}

export interface AutoModelPreviewState {
  isAuto: boolean;
  activityState: UserComposerActivityState;
  decision: AutoModelRouteDecision;
  notifyKeystroke: () => void;
  notifySelectionOrCursorMove: () => void;
}

export function useAutoModelPreview(options: UseAutoModelPreviewOptions): AutoModelPreviewState {
  const {
    selectedModelId,
    text,
    experience,
    webSearch = true,
    memory = true,
    enableNetworkPreview = true,
  } = options;

  const isAuto = isAutoModelSelectorId(selectedModelId);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const [activityState, setActivityState] = useState<UserComposerActivityState>(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "disconnected";
    }

    return text.trim().length > 0 ? "typing" : "idle";
  });

  const lastKeystrokeAtRef = useRef<number | null>(null);
  const lastSelectionAtRef = useRef<number | null>(null);
  const prevTextRef = useRef<string>(text);
  const prevRoutedModelIdRef = useRef<string | undefined>(undefined);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (thinkingTimerRef.current !== null) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleActivityTimers = useCallback(
    (hasDraftText: boolean, online: boolean) => {
      clearTimers();
      if (!online) {
        setActivityState("disconnected");

        return;
      }
      if (!hasDraftText) {
        setActivityState("idle");

        return;
      }

      thinkingTimerRef.current = setTimeout(() => {
        setActivityState((current) => (current === "typing" ? "thinking" : current));
      }, AUTO_MODEL_THINKING_PAUSE_MS);

      idleTimerRef.current = setTimeout(() => {
        setActivityState("idle");
      }, AUTO_MODEL_IDLE_TIMEOUT_MS);
    },
    [clearTimers]
  );

  // Track browser online/offline state
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setActivityState(text.trim().length > 0 ? "thinking" : "idle");
    };
    const handleOffline = () => {
      setIsOnline(false);
      clearTimers();
      setActivityState("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [clearTimers, text]);

  // Track text edits automatically
  useEffect(() => {
    if (prevTextRef.current === text) return;
    const now = Date.now();

    lastKeystrokeAtRef.current = now;
    const hasDraft = text.trim().length > 0;

    if (!isOnline) {
      setActivityState("disconnected");

      return;
    }

    if (!hasDraft) {
      clearTimers();
      setActivityState("idle");

      return;
    }

    setActivityState("typing");
    scheduleActivityTimers(true, isOnline);
  }, [text, isOnline, clearTimers, scheduleActivityTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const notifyKeystroke = useCallback(() => {
    const now = Date.now();

    lastKeystrokeAtRef.current = now;
    if (!isOnline) {
      setActivityState("disconnected");

      return;
    }
    setActivityState("typing");
    scheduleActivityTimers(text.trim().length > 0, isOnline);
  }, [isOnline, scheduleActivityTimers, text]);

  const notifySelectionOrCursorMove = useCallback(() => {
    const now = Date.now();

    lastSelectionAtRef.current = now;
    if (!isOnline) {
      setActivityState("disconnected");

      return;
    }
    if (!text.trim()) {
      setActivityState("idle");

      return;
    }
    const msSinceKey =
      lastKeystrokeAtRef.current !== null ? now - lastKeystrokeAtRef.current : Infinity;

    if (msSinceKey >= AUTO_MODEL_THINKING_PAUSE_MS) {
      setActivityState("reviewing");
      if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setActivityState("idle");
      }, AUTO_MODEL_IDLE_TIMEOUT_MS);
    }
  }, [isOnline, text]);

  const localDecision = useMemo<AutoModelRouteDecision>(() => {
    const computed = previewAutoModelClientSync({
      text,
      previousText: prevTextRef.current,
      previousModelId: prevRoutedModelIdRef.current,
      activityState,
      experience,
      webSearch,
      memory,
    });

    prevRoutedModelIdRef.current = computed.routedModelId;

    return computed;
  }, [text, activityState, experience, webSearch, memory]);

  const [serverDecision, setServerDecision] = useState<AutoModelRouteDecision | null>(null);

  // Debounced POST /api/chat/auto-model when Auto is active and change passes local gate
  useEffect(() => {
    if (!isAuto || !enableNetworkPreview || !isOnline || typeof fetch === "undefined") {
      return;
    }

    const trimmed = text.trim();

    if (!trimmed) {
      setServerDecision(null);
      prevTextRef.current = text;

      return;
    }

    const gate = evaluateAutoModelChangeGateSync({
      text,
      previousText: prevTextRef.current,
      activityState,
      webSearch,
      memory,
    });

    if (!gate.localDelta.passedNoiseThreshold) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const previousTextSnapshot = prevTextRef.current;

      prevTextRef.current = text;

      void fetch("/api/chat/auto-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          previousText: previousTextSnapshot,
          previousModelId: prevRoutedModelIdRef.current,
          activityState,
          experience,
          webSearch,
          memory,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;

          return (await res.json()) as AutoModelRouteDecision;
        })
        .then((data) => {
          if (data && data.selectedSelectorId === "auto" && data.routedModelId) {
            prevRoutedModelIdRef.current = data.routedModelId;
            setServerDecision(data);
          }
        })
        .catch(() => {
          // Instant local preview remains authoritative on abort or offline error.
        });
    }, AUTO_MODEL_NETWORK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isAuto, enableNetworkPreview, isOnline, text, activityState, experience, webSearch, memory]);

  // Prefer local decision immediately when domain shifts so the pill never lags behind typing
  const effectiveDecision = useMemo<AutoModelRouteDecision>(() => {
    if (
      serverDecision &&
      serverDecision.domain === localDecision.domain &&
      text.trim().length > 0
    ) {
      return {
        ...serverDecision,
        activityState,
      };
    }

    return localDecision;
  }, [localDecision, serverDecision, activityState, text]);

  return {
    isAuto,
    activityState,
    decision: effectiveDecision,
    notifyKeystroke,
    notifySelectionOrCursorMove,
  };
}
