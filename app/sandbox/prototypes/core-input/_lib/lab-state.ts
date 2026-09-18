"use client";

import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ContextEffortLevel } from "@/lib/memory/context-effort";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { InputMarkdownMode } from "@/components/chat/core-input/core-input-context";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import { CORE_INPUT_LAYOUT } from "@/components/chat/core-input/layout-breakpoints";
import { DEFAULT_CONTEXT_EFFORT } from "@/lib/memory/context-effort";
import { DEFAULT_CHAT_EFFORT } from "@/lib/schemas/chat-effort";
import { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat-model-ids";

export type LabView = "product" | "focus";
export type LabBackdrop = "chat" | "chrome";
export type LabSendOutcome = "complete" | "error";
/** `none` leaves `experience` undefined, which is what non-Arcadia surfaces pass today. */
export type LabExperience = ChatExperience | "none";

/** Knobs for the shipped `CoreInput` rendered as-is. Mirrors its public props plus stage chrome. */
export type ProductLabState = {
  stageWidthPx: number;
  showStageBounds: boolean;
  showThread: boolean;
  backdrop: LabBackdrop;
  sendOutcome: LabSendOutcome;
  variant: "default" | "compact";
  submitVariant: "default" | "organic-glass";
  experience: LabExperience;
  enableMarkdownInputPreview: boolean;
  /** Provide `useSpeechFriendlyRef`, which is what makes the speech chip render. */
  speechChip: boolean;
  hideWebMemorySpeechToggles: boolean;
  steerButton: boolean;
  steerPending: boolean;
  showContextBudget: boolean;
  sentMessageShimmer: boolean;
  disabled: boolean;
  featureHints: boolean;
};

/** Lab-owned `CoreInputControlsValue` fields plus fixture inputs for isolated controls. */
export type FocusLabState = {
  showLabels: boolean;
  useCondensedLayout: boolean;
  useWebSearch: boolean;
  useMemories: boolean;
  useSpeechFriendly: boolean;
  inputMarkdownMode: InputMarkdownMode;
  modelId: string;
  effort: ChatEffortLevel;
  showContextEffort: boolean;
  contextEffort: ContextEffortLevel;
  /** Drives "has draft" affordances (submit ready vs idle, steer enabled). */
  draftText: string;
  /** 0–1 share of the model's input budget the fixture context budget reports as used. */
  budgetFill: number;
  budgetModelId: string;
};

export type CoreInputLabState = {
  product: ProductLabState;
  focus: FocusLabState;
};

export const LAB_STORAGE_KEY = "organic-llm-lab-core-input-v1";

/**
 * `CoreInput` persists model / effort / memory under caller-provided keys; the lab supplies
 * its own so experiments never rewrite the real chat's preferences. Web search and
 * speech-friendly have no override and stay on the shared keys.
 */
export const LAB_COMPOSER_PREF_KEYS = {
  model: "organic-llm-lab-core-input-model",
  effort: "organic-llm-lab-core-input-effort",
  memories: "organic-llm-lab-core-input-memories",
} as const;

export const STAGE_WIDTH_RANGE = { min: 320, max: 1024, step: 4 } as const;

/** Presets straddle the composer's own breakpoints so each layout mode is one click away. */
export const STAGE_WIDTH_PRESETS = [
  { label: "Phone", widthPx: 375 },
  { label: "Condensed", widthPx: CORE_INPUT_LAYOUT.condensedAtPx - 24 },
  {
    label: "Band",
    widthPx: Math.round((CORE_INPUT_LAYOUT.hideLabelsAtPx + CORE_INPUT_LAYOUT.showLabelsAtPx) / 2),
  },
  { label: "Labels", widthPx: CORE_INPUT_LAYOUT.showLabelsAtPx + 24 },
  { label: "Chat", widthPx: 768 },
  { label: "Wide", widthPx: 960 },
] as const;

/** Matches what `components/chat/chat.tsx` passes for an Arcadia thread, minus coachmarks. */
export const DEFAULT_PRODUCT_STATE: ProductLabState = {
  stageWidthPx: 768,
  showStageBounds: true,
  showThread: true,
  backdrop: "chat",
  sendOutcome: "complete",
  variant: "default",
  submitVariant: "default",
  experience: "arcadia",
  enableMarkdownInputPreview: false,
  speechChip: true,
  hideWebMemorySpeechToggles: false,
  steerButton: false,
  steerPending: false,
  showContextBudget: true,
  sentMessageShimmer: false,
  disabled: false,
  featureHints: false,
};

export const DEFAULT_FOCUS_STATE: FocusLabState = {
  showLabels: true,
  useCondensedLayout: false,
  useWebSearch: true,
  useMemories: true,
  useSpeechFriendly: false,
  inputMarkdownMode: "edit",
  modelId: AUTO_CHAT_MODEL_ID,
  effort: DEFAULT_CHAT_EFFORT,
  showContextEffort: true,
  contextEffort: DEFAULT_CONTEXT_EFFORT,
  draftText: "",
  budgetFill: 0.42,
  // A 200k window so realistic token counts move the ring; Auto's 1M barely registers.
  budgetModelId: "anthropic/claude-haiku-4.5",
};

const DEFAULT_STATE: CoreInputLabState = {
  product: DEFAULT_PRODUCT_STATE,
  focus: DEFAULT_FOCUS_STATE,
};

export type LabPatch<T> = Partial<T> | ((prev: T) => Partial<T>);

function applyPatch<T>(prev: T, patch: LabPatch<T>): T {
  return { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
}

function readStoredState(): CoreInputLabState {
  try {
    const raw = localStorage.getItem(LAB_STORAGE_KEY);

    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as Partial<CoreInputLabState>;

    // Merge over defaults so knobs added later start from their default, not undefined.
    return {
      product: { ...DEFAULT_PRODUCT_STATE, ...(parsed.product ?? {}) },
      focus: { ...DEFAULT_FOCUS_STATE, ...(parsed.focus ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Lab knobs, persisted to localStorage so a full reload during `bun run dev` lands back on
 * the same configuration. View and focused control live in the URL instead (bookmarkable).
 */
export function useCoreInputLabState() {
  const [state, setState] = useState<CoreInputLabState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    setState(readStoredState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — the lab still works for this session */
    }
  }, [hydrated, state]);

  const patchProduct = useCallback((patch: LabPatch<ProductLabState>) => {
    setState((prev) => ({ ...prev, product: applyPatch(prev.product, patch) }));
  }, []);

  const patchFocus = useCallback((patch: LabPatch<FocusLabState>) => {
    setState((prev) => ({ ...prev, focus: applyPatch(prev.focus, patch) }));
  }, []);

  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  return { state, hydrated, patchProduct, patchFocus, reset };
}
