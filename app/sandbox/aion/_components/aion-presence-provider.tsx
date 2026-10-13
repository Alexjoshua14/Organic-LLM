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

export type AionChatSend = (text: string, trigger?: AionEvent) => void;

export type AionVoiceBridge = {
  connected: boolean;
  sendTextEvent?: (text: string) => boolean;
};

type AionPresenceContextValue = {
  emit: typeof emitAionEvent;
  registerChatSend: (send: AionChatSend | null) => void;
  registerVoiceBridge: (bridge: AionVoiceBridge | null) => void;
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
  const chatSendRef = useRef<AionChatSend | null>(null);
  const voiceBridgeRef = useRef<AionVoiceBridge | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMicroRef = useRef<AionEvent | null>(null);
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
    scheduleDormancy();

    return () => {
      if (dormantTimerRef.current) clearTimeout(dormantTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [scheduleDormancy]);

  const runMicroTurn = useCallback(
    async (event: AionEvent) => {
      const state = aionPresenceStore.getState();

      if (state.busy) return;

      setAionPresenceBusy(true);
      setAionPresencePhase("thinking");

      try {
        const res = await fetch("/api/ai/aion/event", {
          method: "POST",
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

        if (data.threadId) setAionPresenceThreadId(data.threadId);

        applyAionPresenceTurnResult({
          budget: data.budget ?? null,
          threadId: data.threadId,
          clearLedger: true,
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
          window.setTimeout(() => setAionPresencePhase("active"), reduceMotion ? 0 : 2_000);
        }

        scheduleDormancy();
      } catch (err) {
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
        setAionPresencePhase(reduceMotion ? "idle" : "active");
        scheduleDormancy();

        return event;
      }

      if (decision.tier === "full") {
        const send = chatSendRef.current;

        if (send) {
          clearAionPresenceLedger();
          send(`[${event.kind}] ${event.label}`, event);
          setAionPresencePhase("thinking");
        } else {
          // No chat bridge yet — fall back to micro.
          void runMicroTurn(event);
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
    }),
    [handleEvent, registerChatSend, registerVoiceBridge]
  );

  return <AionPresenceContext.Provider value={value}>{children}</AionPresenceContext.Provider>;
}
