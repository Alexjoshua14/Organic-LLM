const PERF_STORAGE_KEY = "ol:perf";

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

export function isPerfEnabled(): boolean {
  if (typeof window === "undefined") return false;

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
