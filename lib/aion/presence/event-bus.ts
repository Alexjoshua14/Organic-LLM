"use client";

import type {
  AionEvent,
  AionLedgerEntry,
  AionPresenceBudgetSnapshot,
  AionPresencePhase,
  AionTurnTier,
} from "@/lib/schemas/aion-presence";

import { useCallback } from "react";

import { createPersistentStore } from "@/lib/client-store/persistent-store";
import { clientRandomUUID } from "@/lib/client-uuid";
import { AION_LEDGER_MAX } from "@/lib/aion/presence/turn-policy";

export type AionPresenceHudEntry = {
  at: number;
  tier: AionTurnTier;
  reason: string;
  coalesceKey: string;
  label: string;
  kind: AionEvent["kind"];
};

export type AionPresenceLastTurn = {
  at: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  modelId?: string;
  costUsd?: number;
  silent?: boolean;
  text?: string | null;
};

export type AionPresenceState = {
  phase: AionPresencePhase;
  /** Ring buffer of recent Tier-0 (+ acknowledged) events for the next real turn. */
  ledger: AionLedgerEntry[];
  /** Last few policy decisions for the HUD. */
  decisions: AionPresenceHudEntry[];
  lastTurnAt: number;
  lastCoalesceKey: string | null;
  lastCoalesceAt: number;
  busy: boolean;
  dormant: boolean;
  budget: AionPresenceBudgetSnapshot | null;
  lastTurn: AionPresenceLastTurn | null;
  threadId: string | null;
  modelId: string | null;
  enabled: boolean;
};

const INITIAL: AionPresenceState = {
  phase: "idle",
  ledger: [],
  decisions: [],
  lastTurnAt: Date.now(),
  lastCoalesceKey: null,
  lastCoalesceAt: 0,
  busy: false,
  dormant: false,
  budget: null,
  lastTurn: null,
  threadId: null,
  modelId: null,
  enabled: true,
};

const MAX_DECISIONS = 24;

/**
 * In-memory presence store. Persistence is disabled for the ledger/phase so a
 * reload starts clean; threadId and budget snapshot hydrate from the server.
 */
export const aionPresenceStore = createPersistentStore<AionPresenceState>(
  "organic-llm.aion-presence.v1",
  INITIAL,
  {
    validate: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const obj = raw as Partial<AionPresenceState>;

      // Only restore durable knobs; never restore a stale ledger or phase.
      return {
        ...INITIAL,
        enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
        modelId: typeof obj.modelId === "string" ? obj.modelId : null,
        threadId: typeof obj.threadId === "string" ? obj.threadId : null,
      };
    },
  }
);

export function emitAionEvent(
  partial: Omit<AionEvent, "id" | "at"> & { id?: string; at?: number }
): AionEvent {
  const event: AionEvent = {
    id: partial.id ?? clientRandomUUID(),
    at: partial.at ?? Date.now(),
    kind: partial.kind,
    surface: partial.surface,
    label: partial.label,
    ...(partial.payload ? { payload: partial.payload } : {}),
  };

  aionPresenceStore.setState((prev) => {
    const entry: AionLedgerEntry = {
      kind: event.kind,
      label: event.label,
      at: event.at,
    };
    const ledger = [...prev.ledger, entry].slice(-AION_LEDGER_MAX);

    return {
      ...prev,
      ledger,
      phase: prev.phase === "idle" ? "active" : prev.phase,
      dormant: false,
    };
  });

  return event;
}

export function recordAionDecision(entry: AionPresenceHudEntry): void {
  aionPresenceStore.setState((prev) => ({
    ...prev,
    decisions: [...prev.decisions, entry].slice(-MAX_DECISIONS),
    lastCoalesceKey: entry.coalesceKey,
    lastCoalesceAt: entry.at,
  }));
}

export function setAionPresencePhase(phase: AionPresencePhase): void {
  aionPresenceStore.setState((prev) => (prev.phase === phase ? prev : { ...prev, phase }));
}

export function setAionPresenceBusy(busy: boolean): void {
  aionPresenceStore.setState((prev) => (prev.busy === busy ? prev : { ...prev, busy }));
}

export function setAionPresenceDormant(dormant: boolean): void {
  aionPresenceStore.setState((prev) => {
    if (prev.dormant === dormant) return prev;

    return {
      ...prev,
      dormant,
      phase: dormant ? "idle" : prev.phase,
    };
  });
}

export function clearAionPresenceLedger(): void {
  aionPresenceStore.setState((prev) => (prev.ledger.length === 0 ? prev : { ...prev, ledger: [] }));
}

export function applyAionPresenceTurnResult(args: {
  budget?: AionPresenceBudgetSnapshot | null;
  lastTurn: AionPresenceLastTurn;
  threadId?: string | null;
  clearLedger?: boolean;
}): void {
  aionPresenceStore.setState((prev) => ({
    ...prev,
    budget: args.budget ?? prev.budget,
    lastTurn: args.lastTurn,
    lastTurnAt: args.lastTurn.at,
    threadId: args.threadId ?? prev.threadId,
    ledger: args.clearLedger ? [] : prev.ledger,
    busy: false,
    phase: args.lastTurn.silent ? "active" : "responding",
  }));
}

export function setAionPresenceBudget(budget: AionPresenceBudgetSnapshot | null): void {
  aionPresenceStore.setState((prev) => ({ ...prev, budget }));
}

export function setAionPresenceThreadId(threadId: string | null): void {
  aionPresenceStore.setState((prev) => ({ ...prev, threadId }));
}

export function setAionPresenceModelId(modelId: string | null): void {
  aionPresenceStore.setState((prev) => ({ ...prev, modelId }));
}

export function setAionPresenceEnabled(enabled: boolean): void {
  aionPresenceStore.setState((prev) => ({ ...prev, enabled }));
}

/** React hook selectors for the presence store. */
export function useAionPresenceStore<S>(selector: (state: AionPresenceState) => S): S {
  return aionPresenceStore.useStore(selector);
}

export function useEmitAionEvent() {
  return useCallback(
    (partial: Omit<AionEvent, "id" | "at"> & { id?: string; at?: number }) =>
      emitAionEvent(partial),
    []
  );
}
