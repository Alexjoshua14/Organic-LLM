"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { usePerfSession } from "@/hooks/use-perf-session";
import { PERF_PHASES } from "@/lib/perf/journeys";
import { mark, startJourney } from "@/lib/perf/trace-store";

const PerfHud = dynamic(() => import("./perf-hud").then((m) => m.PerfHud), { ssr: false });

const ARCADIA_HREF_PREFIX = "/sandbox/arcadia";

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function PerfHudGate() {
  const pathname = usePathname() ?? "";
  const { isLoaded, isSignedIn } = useAuth();
  const enabled = usePerfSession({ isLoaded, isSignedIn, pathname });
  const prevPathRef = useRef<string | null>(null);

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
    if (!enabled) {
      prevPathRef.current = null;

      return;
    }

    if (prevPathRef.current !== null && prevPathRef.current !== pathname) {
      mark(PERF_PHASES.navCommitted, { path: pathname });
    }

    prevPathRef.current = pathname;
  }, [enabled, pathname]);

  if (!enabled) return null;

  return <PerfHud />;
}
