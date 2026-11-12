"use client";

import type { AionEvent, AionEventResponse } from "@/lib/schemas/aion-presence";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";

import {
  applyAionPresenceTurnResult,
  aionPresenceStore,
  clearAionPresenceLedger,
  emitAionEvent,
  recordAionDecision,
  setAionPresenceError,
  setAionPresenceBudget,
  setAionPresenceBusy,
  setAionPresenceDormant,
  setAionPresenceModelId,
  setAionPresencePhase,
  setAionPresenceThreadId,
  useAionPresenceStore,
} from "@/lib/aion/presence/event-bus";
import { AION_IDLE_DORMANT_MS, decideAionTurnTier } from "@/lib/aion/presence/turn-policy";
import { DEFAULT_AION_THREAD_POLICY } from "@/lib/schemas/aion-presence";
import { models } from "@/lib/schemas/chat-models";
import { createLogger } from "@/lib/logger";

const logger = createLogger("aion-presence-provider");

export type AionChatSend = (text: string) => Promise<void>;

export type AionVoiceBridge = {
  connected: boolean;
  sendTextEvent?: (text: string) => boolean;
};

type AionPresenceContextValue = {
  emit: typeof emitAionEvent;
  registerChatSend: (send: AionChatSend | null) => void;
  registerVoiceBridge: (bridge: AionVoiceBridge | null) => void;
  reportChatStatus: (status: "submitted" | "streaming" | "ready" | "error") => void;
};

const AionPresenceContext = createContext<AionPresenceContextValue | null>(null);

export function useAionPresence(): AionPresenceContextValue {
  const ctx = useContext(AionPresenceContext);

  if (!ctx) {
    throw new Error("useAionPresence must be used within AionPresenceProvider");
  }

  return ctx;
}

type AionPresenceProviderProps = {
  children: ReactNode;
  /** Optional initial thread id from the page resolver. */
  initialThreadId?: string | null;
  /** Lab model override; defaults to the cheap presence model. */
  modelId?: string;
};

export function AionPresenceProvider({
  children,
  initialThreadId = null,
  modelId = models.openai.oss20b.id,
}: AionPresenceProviderProps) {
  const reduceMotion = useReducedMotion();
  const mountedRef = useRef(true);
  const chatBusyRef = useRef(false);
  const microAbortRef = useRef<AbortController | null>(null);
  const chatSendRef = useRef<AionChatSend | null>(null);
  const voiceBridgeRef = useRef<AionVoiceBridge | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMicroRef = useRef<AionEvent | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dormantTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enabled = useAionPresenceStore((s) => s.enabled);

  useEffect(() => {
    if (initialThreadId) setAionPresenceThreadId(initialThreadId);
    setAionPresenceModelId(modelId);
  }, [initialThreadId, modelId]);

  const scheduleDormancy = useCallback(() => {
    if (dormantTimerRef.current) clearTimeout(dormantTimerRef.current);
    dormantTimerRef.current = setTimeout(() => {
      setAionPresenceDormant(true);
    }, AION_IDLE_DORMANT_MS);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      pendingMicroRef.current = null;
      microAbortRef.current?.abort();
      if (!chatBusyRef.current) {
        setAionPresenceBusy(false);
        setAionPresencePhase("idle");
      }
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    scheduleDormancy();

    return () => {
      mountedRef.current = false;
      chatSendRef.current = null;
      setAionPresenceBusy(false);
      setAionPresencePhase("idle");
      microAbortRef.current?.abort();
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (dormantTimerRef.current) clearTimeout(dormantTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [scheduleDormancy]);

  const runMicroTurn = useCallback(
    async (event: AionEvent) => {
      const state = aionPresenceStore.getState();

      if (state.busy || chatBusyRef.current || !state.enabled) return;
      const controller = new AbortController();

      microAbortRef.current = controller;
      setAionPresenceError(null);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);

      setAionPresenceBusy(true);
      setAionPresencePhase("thinking");

      try {
        const res = await fetch("/api/ai/aion/event", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            threadId: state.threadId,
            threadPolicy: DEFAULT_AION_THREAD_POLICY,
            ledger: state.ledger,
            memory: false,
            modelId: state.modelId ?? modelId,
          }),
        });
        const data = (await res.json()) as AionEventResponse;

        if (controller.signal.aborted) return;
        if (!res.ok || data.error) {
          if (data.budget) setAionPresenceBudget(data.budget);
          throw new Error(data.error ?? "Presence request failed");
        }

        if (data.threadId) setAionPresenceThreadId(data.threadId);

        applyAionPresenceTurnResult({
          budget: data.budget ?? null,
          threadId: data.threadId,
          acknowledgedLedger: state.ledger,
          lastTurn: {
            at: Date.now(),
            inputTokens: data.usage?.inputTokens,
            outputTokens: data.usage?.outputTokens,
            totalTokens: data.usage?.totalTokens,
            durationMs: data.usage?.durationMs,
            modelId: data.usage?.modelId,
            costUsd: data.usage?.costUsd,
            silent: data.silent,
            text: data.text,
          },
        });

        if (data.silent || !data.text) {
          setAionPresencePhase(reduceMotion ? "idle" : "active");
        } else {
          setAionPresencePhase("responding");
          // Settle back to active after a short presence window.
          settleTimerRef.current = setTimeout(
            () => {
              if (!aionPresenceStore.getState().busy) setAionPresencePhase("active");
            },
            reduceMotion ? 0 : 2_000
          );
        }

        scheduleDormancy();
      } catch (err) {
        if (controller.signal.aborted) return;
        setAionPresenceError(
          "Aion could not process the event. Try another event or continue in chat."
        );
        logger.error("runMicroTurn", err instanceof Error ? err.message : String(err));
        setAionPresenceBusy(false);
        setAionPresencePhase("idle");
      }
    },
    [modelId, reduceMotion, scheduleDormancy]
  );

  const handleEvent = useCallback(
    (partial: Omit<AionEvent, "id" | "at"> & { id?: string; at?: number }) => {
      const event = emitAionEvent(partial);
      const state = aionPresenceStore.getState();
      const now = Date.now();
      const idleMs = now - state.lastTurnAt;
      const msSinceSameCoalesceKey =
        state.lastCoalesceKey &&
        state.lastCoalesceKey === `${event.kind}:${event.surface}:${event.label}`
          ? now - state.lastCoalesceAt
          : 0;

      const decision = decideAionTurnTier(event, {
        enabled: state.enabled && enabled,
        idleMs,
        msSinceSameCoalesceKey,
        busy: state.busy,
      });

      recordAionDecision({
        at: now,
        tier: decision.tier,
        reason: decision.reason,
        coalesceKey: decision.coalesceKey,
        label: event.label,
        kind: event.kind,
      });

      if (decision.tier === "none") {
        if (!state.busy) setAionPresencePhase(reduceMotion ? "idle" : "active");
        scheduleDormancy();

        return event;
      }

      if (decision.tier === "full") {
        const send = chatSendRef.current;

        if (send) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
          pendingMicroRef.current = null;
          setAionPresenceBusy(true);
          setAionPresencePhase("thinking");
          void send(
            `[${event.kind}] ${event.label}\n\nRecent sandbox events (context only): ${JSON.stringify(state.ledger)}`
          )
            .then(() => {
              if (!mountedRef.current) return;
              clearAionPresenceLedger(state.ledger);
            })
            .catch((err) => {
              logger.error("fullTurn", err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
              if (!mountedRef.current) return;
              setAionPresenceBusy(false);
              setAionPresencePhase("idle");
            });
        } else {
          setAionPresenceError("The conversation is still loading. Try asking again in a moment.");
        }

        scheduleDormancy();

        return event;
      }

      // Tier micro: prefer live Speak voice bridge when connected.
      const voice = voiceBridgeRef.current;

      if (voice?.connected && voice.sendTextEvent) {
        const sent = voice.sendTextEvent(`[${event.kind}] ${event.label}`);

        if (sent) {
          clearAionPresenceLedger();
          setAionPresencePhase("thinking");
          scheduleDormancy();

          return event;
        }
      }

      pendingMicroRef.current = event;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const pending = pendingMicroRef.current;

        pendingMicroRef.current = null;
        if (pending) void runMicroTurn(pending);
      }, decision.delayMs);

      return event;
    },
    [enabled, reduceMotion, runMicroTurn, scheduleDormancy]
  );

  const reportChatStatus = useCallback(
    (status: "submitted" | "streaming" | "ready" | "error") => {
      const busy = status === "submitted" || status === "streaming";
      const wasBusy = chatBusyRef.current;

      chatBusyRef.current = busy;
      if (busy) {
        microAbortRef.current?.abort();
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        pendingMicroRef.current = null;
        setAionPresenceBusy(true);
        setAionPresencePhase(status === "submitted" ? "thinking" : "responding");
      } else if (wasBusy) {
        setAionPresenceBusy(false);
        setAionPresencePhase("idle");
        scheduleDormancy();
      }
    },
    [scheduleDormancy]
  );

  const registerChatSend = useCallback((send: AionChatSend | null) => {
    chatSendRef.current = send;
  }, []);

  const registerVoiceBridge = useCallback((bridge: AionVoiceBridge | null) => {
    voiceBridgeRef.current = bridge;
  }, []);

  const value = useMemo<AionPresenceContextValue>(
    () => ({
      emit: handleEvent,
      registerChatSend,
      registerVoiceBridge,
      reportChatStatus,
    }),
    [handleEvent, registerChatSend, registerVoiceBridge, reportChatStatus]
  );

  return <AionPresenceContext.Provider value={value}>{children}</AionPresenceContext.Provider>;
}
