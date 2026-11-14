const PERF_STORAGE_KEY = "ol:perf";
let sessionAllowed = false;
let consentOn = false;

/** Runtime auth gate; never persisted alongside the user's debug preference. */
export function setPerfSessionAllowed(allowed: boolean): void {
  sessionAllowed = allowed;
}

/**
 * The signed-in user's account-level choice to share anonymous performance timings. Set from the
 * server-held record (never assumed): no record, no table, or an error all leave it off.
 */
export function setPerfConsentOn(on: boolean): void {
  consentOn = on;
}

/**
 * Whether marks and traces are recorded in this tab: a signed-in session that either shares
 * metrics or has turned on the local debug flag. The flag alone never reports anything.
 */
export function isPerfCollecting(): boolean {
  return sessionAllowed && (consentOn || isPerfEnabled());
}

/** Whether finished traces may be sent to the server. Requires consent; the debug flag does not. */
export function isPerfReportingAllowed(): boolean {
  return sessionAllowed && consentOn;
}

/** URL query `?perf=1` enables; `?perf=0` disables. */
export function readPerfFlagFromSearch(search: string): boolean | null {
  try {
    const q = new URLSearchParams(search);
    const v = q.get("perf");

    if (v === "1" || v === "true" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "no") return false;

    return null;
  } catch {
    return null;
  }
}

/** The local debug flag (HUD, console log, sessionStorage history). Signed-in sessions only. */
export function isPerfEnabled(): boolean {
  if (typeof window === "undefined" || !sessionAllowed) return false;

  try {
    return sessionStorage.getItem(PERF_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPerfEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;

  try {
    if (enabled) {
      sessionStorage.setItem(PERF_STORAGE_KEY, "1");
    } else {
      sessionStorage.removeItem(PERF_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function applyPerfFlagFromSearch(search: string): boolean | null {
  const flag = readPerfFlagFromSearch(search);

  if (flag === null) return null;
  setPerfEnabled(flag);

  return flag;
}
