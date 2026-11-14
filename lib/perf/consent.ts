"use client";

import { setPerfConsentOn } from "./enabled";
import { clearPerfReportQueue } from "./report";

/**
 * The signed-in account's choice to share anonymous performance timings.
 *
 * The server holds the real record (`perf_metrics_consent`) and enforces it: the ingest route
 * drops events from any account that is not "on". This store mirrors it so the UI can show it and
 * the reporter can stop at once. A tiny per-account hint in localStorage ("on" only) lets the very
 * first page view of a visit be measured while the server answer is still in flight; it is never
 * sent anywhere, and the server answer overrides it.
 */

export type PerfConsentUiState = "loading" | "on" | "off" | "unset" | "unavailable";

const HINT_PREFIX = "ol:perf-consent:";

let state: PerfConsentUiState = "loading";
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function apply(next: PerfConsentUiState) {
  state = next;
  setPerfConsentOn(next === "on");
  if (next !== "on") clearPerfReportQueue();
  for (const listener of listeners) listener();
}

function writeHint(userId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(HINT_PREFIX + userId, "on");
    else localStorage.removeItem(HINT_PREFIX + userId);
  } catch {
    // Private mode etc.: the hint is only an optimization.
  }
}

export function getPerfConsentState(): PerfConsentUiState {
  return state;
}

export function subscribePerfConsent(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Called as soon as a signed-in user is known, before the server answers. */
export function primePerfConsent(userId: string) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  state = "loading";
  let hinted = false;

  try {
    hinted = localStorage.getItem(HINT_PREFIX + userId) === "on";
  } catch {
    hinted = false;
  }
  setPerfConsentOn(hinted);
}

/** Fetches the account's server-held choice. Fails closed: any error means "do not collect". */
export async function loadPerfConsent(userId: string): Promise<void> {
  primePerfConsent(userId);

  try {
    const res = await fetch("/api/perf/consent", { cache: "no-store" });

    if (!res.ok) return apply("unavailable");

    const json = (await res.json()) as { state?: string };
    const next = json.state;

    if (next === "on" || next === "off" || next === "unset" || next === "unavailable") {
      if (currentUserId === userId) {
        writeHint(userId, next === "on");
        apply(next);
      }

      return;
    }
    apply("unavailable");
  } catch {
    apply("unavailable");
  }
}

/**
 * Turns sharing on or off for this account, going forward. Applied immediately; reverted if the
 * server cannot record it, so the toggle never claims something that is not true.
 */
export async function setPerfConsent(enabled: boolean): Promise<boolean> {
  const previous = state;
  const userId = currentUserId;

  apply(enabled ? "on" : "off");

  try {
    const res = await fetch("/api/perf/consent", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const json = (await res.json().catch(() => null)) as { state?: string } | null;
    const confirmed = enabled ? "on" : "off";

    if (res.ok && json?.state === confirmed) {
      if (userId) writeHint(userId, enabled);

      return true;
    }
  } catch {
    // fall through to the revert
  }
  apply(previous === "loading" ? "unavailable" : previous);

  return false;
}

/** Sign-out: forget everything account-specific. */
export function resetPerfConsent() {
  currentUserId = null;
  apply("loading");
}
