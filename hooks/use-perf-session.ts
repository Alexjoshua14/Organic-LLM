"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { applyPerfFlagFromSearch, isPerfEnabled, setPerfSessionAllowed } from "@/lib/perf/enabled";
import { PERF_PHASES } from "@/lib/perf/journeys";
import {
  discardActivePerfTrace,
  initPerfTraceStore,
  mark,
  markAt,
  startJourney,
} from "@/lib/perf/trace-store";

function seedNavigationTimings(): () => void {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (nav) {
    markAt(PERF_PHASES.navTtfb, nav.responseStart);
    markAt(PERF_PHASES.navDcl, nav.domContentLoadedEventEnd);
  }

  for (const entry of performance.getEntriesByType("paint")) {
    if (entry.name === "first-contentful-paint") {
      markAt(PERF_PHASES.navFcp, entry.startTime);
    }
  }

  let disposed = false;
  let observer: PerformanceObserver | undefined;

  try {
    observer = new PerformanceObserver((list) => {
      if (disposed) return;
      const entries = list.getEntries();
      const last = entries[entries.length - 1];

      if (last) markAt(PERF_PHASES.navLcp, last.startTime);
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // LCP not supported
  }

  return () => {
    disposed = true;
    observer?.disconnect();
  };
}

/** Owned by the persistent root HUD gate, including while auth is unresolved. */
export function usePerfSession({
  isLoaded,
  isSignedIn,
  pathname,
}: {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  pathname: string;
}): boolean {
  const [enabled, setEnabled] = useState(false);
  const initialPath = useRef(pathname);
  const authResolved = useRef(false);
  const loadEligible = useRef(pathname === "/");
  const initialized = useRef(false);

  // Layout effects run before the composer's passive effect schedules its ready mark.
  useLayoutEffect(() => {
    applyPerfFlagFromSearch(window.location.search);
    const signedIn = isLoaded && isSignedIn === true;

    if (!signedIn && (isLoaded || authResolved.current)) {
      loadEligible.current = false;
    }
    if (isLoaded) authResolved.current = true;

    setPerfSessionAllowed(signedIn);
    const collecting = isPerfEnabled();

    setEnabled(collecting);

    if (!collecting) {
      discardActivePerfTrace();

      return;
    }

    if (!initialized.current) {
      initPerfTraceStore();
      initialized.current = true;
    }

    let disconnect: (() => void) | undefined;

    if (loadEligible.current && window.location.pathname === initialPath.current) {
      // Only an initially signed-in home visit measures time from document navigation.
      startJourney("load", `document:${initialPath.current}`, { startedAt: 0 });
      disconnect = seedNavigationTimings();
      mark(PERF_PHASES.appHydrated);
    }

    return () => {
      setPerfSessionAllowed(false);
      disconnect?.();
      discardActivePerfTrace();
    };
  }, [isLoaded, isSignedIn]);

  return isLoaded && isSignedIn === true && enabled;
}
