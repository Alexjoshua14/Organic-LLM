"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PERF_PHASES } from "@/lib/perf/journeys";
import { applyPerfFlagFromSearch, isPerfEnabled } from "@/lib/perf/enabled";
import { initPerfTraceStore, mark, markAt, startJourney } from "@/lib/perf/trace-store";

const PerfHud = dynamic(() => import("./perf-hud").then((m) => m.PerfHud), { ssr: false });

const ARCADIA_HREF_PREFIX = "/sandbox/arcadia";

function seedNavigationTimings(): void {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (nav) {
    markAt(PERF_PHASES.navTtfb, nav.responseStart);
    markAt(PERF_PHASES.navDcl, nav.domContentLoadedEventEnd);
  }

  const paints = performance.getEntriesByType("paint");

  for (const entry of paints) {
    if (entry.name === "first-contentful-paint") {
      markAt(PERF_PHASES.navFcp, entry.startTime);
    }
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];

      if (last) {
        markAt(PERF_PHASES.navLcp, last.startTime);
      }
    });

    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // LCP not supported
  }
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function PerfHudGate() {
  const pathname = usePathname() ?? "";
  const [enabled, setEnabled] = useState(false);
  const prevPathRef = useRef<string | null>(null);
  const loadStartedRef = useRef(false);

  useEffect(() => {
    applyPerfFlagFromSearch(window.location.search);
    initPerfTraceStore();
    setEnabled(isPerfEnabled());

    if (!isPerfEnabled()) return;

    if (!loadStartedRef.current) {
      loadStartedRef.current = true;

      // startedAt 0 aligns client marks with PerformanceNavigationTiming / paint entries.
      startJourney("load", `document:${window.location.pathname}`, { startedAt: 0 });

      seedNavigationTimings();
      mark(PERF_PHASES.appHydrated);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) return;

      const target = event.target;

      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");

      if (!href || !href.startsWith(ARCADIA_HREF_PREFIX)) return;

      startJourney("to-arcadia", `link:${window.location.pathname}`);
    };

    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (prevPathRef.current !== null && prevPathRef.current !== pathname) {
      mark(PERF_PHASES.navCommitted, { path: pathname });
    }

    prevPathRef.current = pathname;
  }, [enabled, pathname]);

  if (!enabled) return null;

  return <PerfHud />;
}
