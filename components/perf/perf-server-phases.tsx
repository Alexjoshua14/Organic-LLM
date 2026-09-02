"use client";

import type { PerfJourneyId } from "@/lib/perf/journeys";

import { useEffect } from "react";

import { addServerPhases } from "@/lib/perf/trace-store";

type PerfServerPhasesProps = {
  journey: PerfJourneyId;
  phases: Array<{ name: string; ms: number }>;
};

/** Hydrates server-phase timings into the active client trace. Renders nothing. */
export function PerfServerPhases({ phases }: PerfServerPhasesProps) {
  const phasesKey = phases.map((p) => `${p.name}:${p.ms}`).join("|");

  useEffect(() => {
    if (phases.length === 0) return;
    addServerPhases(phases);
    // phasesKey captures content; phases array identity may change per render.
  }, [phasesKey]);

  return null;
}
