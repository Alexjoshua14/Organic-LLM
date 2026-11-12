"use client";

import { useSyncExternalStore } from "react";

import {
  getPerfConsentState,
  subscribePerfConsent,
  type PerfConsentUiState,
} from "@/lib/perf/consent";

/** The signed-in account's current choice about sharing anonymous timings. */
export function usePerfConsent(): PerfConsentUiState {
  return useSyncExternalStore(subscribePerfConsent, getPerfConsentState, () => "loading");
}
