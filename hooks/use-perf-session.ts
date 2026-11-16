"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  applyPerfFlagFromSearch,
  isPerfCollecting,
  isPerfEnabled,
  setPerfSessionAllowed,
} from "@/lib/perf/enabled";
import { loadPerfConsent, primePerfConsent, resetPerfConsent } from "@/lib/perf/consent";
import { perfRouteTemplate } from "@/lib/perf/events";
import { initPerfObservers } from "@/lib/perf/measure";
import { PERF_PHASES } from "@/lib/perf/journeys";
import {
  discardActivePerfTrace,
  getActiveJourneyId,
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

/** Routes whose first paint is measured when they are the initial document. */
const LOAD_JOURNEY_ROUTES = new Set(["/", "/chat/[id]", "/arcadia/[id]"]);

/**
 * Owned by the persistent root HUD gate, including while auth is unresolved. Collection (marks,
 * traces, anonymous reporting) depends on a signed-in session plus the account's consent; the
 * returned boolean is only whether the local debug HUD (`?perf=1`) should render.
 */
export function usePerfSession({
  isLoaded,
  isSignedIn,
  pathname,
  userId,
}: {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  pathname: string;
  userId?: string | null;
}): boolean {
  const [enabled, setEnabled] = useState(false);
  const initialPath = useRef(pathname);
  const authResolved = useRef(false);
  const loadEligible = useRef(LOAD_JOURNEY_ROUTES.has(perfRouteTemplate(pathname)));
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
    if (signedIn && userId) primePerfConsent(userId);
    if (isLoaded && !signedIn) resetPerfConsent();
    const collecting = isPerfCollecting();

    setEnabled(isPerfEnabled());

    if (!collecting) {
      discardActivePerfTrace();

      return;
    }

    if (!initialized.current) {
      initPerfTraceStore();
      initialized.current = true;
    }
    // Before any journey can finish: the long-task and LCP observers, and a larger resource buffer.
    initPerfObservers();

    let disconnect: (() => void) | undefined;

    if (loadEligible.current && window.location.pathname === initialPath.current) {
      // Only an initially signed-in visit to a measured route times from document navigation.
      startJourney("load", `document:${initialPath.current}`, { startedAt: 0 });
      disconnect = seedNavigationTimings();
      mark(PERF_PHASES.appHydrated);
      // When every font the page asked for has arrived. Only counts while this load is the
      // journey being timed; a later interaction must not inherit it.
      void document.fonts?.ready
        ?.then(() => {
          if (getActiveJourneyId() === "load") markAt(PERF_PHASES.fontsReady, performance.now());
        })
        .catch(() => {});
    }

    return () => {
      setPerfSessionAllowed(false);
      disconnect?.();
      discardActivePerfTrace();
    };
  }, [isLoaded, isSignedIn]);

  // The server-held choice decides whether timings are shared; ask once per signed-in user.
  useEffect(() => {
    if (isLoaded && isSignedIn === true && userId) void loadPerfConsent(userId);
  }, [isLoaded, isSignedIn, userId]);

  return isLoaded && isSignedIn === true && enabled;
}
