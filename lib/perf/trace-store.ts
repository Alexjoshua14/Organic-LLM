"use client";

import type { PerfJourneyId } from "./journeys";

import { isPerfEnabled } from "./enabled";

import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/perf/trace-store.ts");

const TRACES_STORAGE_KEY = "ol:perf-traces";
const MAX_TRACES = 20;

export type PerfTraceStatus = "active" | "complete" | "abandoned";

export type PerfClientMark = {
  name: string;
  t: number;
  detail?: Record<string, unknown>;
};

export type PerfServerPhase = {
  name: string;
  ms: number;
  source: "server";
};

export type PerfTrace = {
  id: string;
  journey: PerfJourneyId;
  trigger: string;
  startedAt: number;
  pathAtStart: string;
  marks: PerfClientMark[];
  serverPhases: PerfServerPhase[];
  headlineMs: number | null;
  headlinePhase: string | null;
  status: PerfTraceStatus;
  completedAt: number | null;
};

type Listener = () => void;

let activeTrace: PerfTrace | null = null;
let traceRing: PerfTrace[] = [];
const listeners = new Set<Listener>();

/** Stable reference for useSyncExternalStore — replaced only when trace state changes. */
let snapshot: { active: PerfTrace | null; traces: PerfTrace[] } = {
  active: null,
  traces: [],
};

function refreshSnapshot(): void {
  snapshot = { active: activeTrace, traces: traceRing };
}

function now(): number {
  return performance.now();
}

function traceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emitUserTimingMark(journey: PerfJourneyId, phase: string): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;

  try {
    performance.mark(`ol:${journey}:${phase}`);
  } catch {
    // ignore duplicate or invalid marks
  }
}

function emitUserTimingMeasure(trace: PerfTrace): void {
  if (
    typeof performance === "undefined" ||
    typeof performance.measure !== "function" ||
    trace.headlineMs == null
  ) {
    return;
  }

  const startMark = `ol:${trace.journey}:start`;
  const endMark = `ol:${trace.journey}:complete`;

  try {
    performance.mark(startMark, { startTime: trace.startedAt });
    performance.mark(endMark, { startTime: trace.startedAt + trace.headlineMs });
    performance.measure(`ol:${trace.journey}`, startMark, endMark);
  } catch {
    // ignore
  }
}

function logCompletion(trace: PerfTrace): void {
  logger.log(
    "complete",
    JSON.stringify({
      event: "perf_journey_complete",
      journey: trace.journey,
      trigger: trace.trigger,
      headlineMs: trace.headlineMs,
      headlinePhase: trace.headlinePhase,
      pathAtStart: trace.pathAtStart,
      marks: trace.marks.map((m) => ({ name: m.name, t: Math.round(m.t) })),
      serverPhases: trace.serverPhases,
      status: trace.status,
    })
  );
}

function persistTraces(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(TRACES_STORAGE_KEY, JSON.stringify(traceRing));
  } catch {
    // ignore quota
  }
}

function loadTracesFromStorage(): void {
  if (typeof window === "undefined") return;

  try {
    const raw = sessionStorage.getItem(TRACES_STORAGE_KEY);

    if (!raw) return;
    const parsed = JSON.parse(raw) as PerfTrace[];

    if (Array.isArray(parsed)) {
      traceRing = parsed.slice(0, MAX_TRACES);
    }
  } catch {
    traceRing = [];
  }
}

function notify(): void {
  refreshSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

function finalizeActive(status: PerfTraceStatus): void {
  if (!activeTrace) return;

  activeTrace.status = status;
  activeTrace.completedAt = now();

  if (status === "complete" && activeTrace.headlineMs != null) {
    emitUserTimingMeasure(activeTrace);
    logCompletion(activeTrace);
  }

  traceRing = [activeTrace, ...traceRing].slice(0, MAX_TRACES);
  persistTraces();
  activeTrace = null;
  notify();
}

function pathAtStart(): string {
  if (typeof window === "undefined") return "";

  return window.location.pathname;
}

export function subscribePerfTraces(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getPerfSnapshot(): { active: PerfTrace | null; traces: PerfTrace[] } {
  return snapshot;
}

export function initPerfTraceStore(): void {
  loadTracesFromStorage();
  refreshSnapshot();
}

export function getActiveJourneyId(): PerfJourneyId | null {
  return activeTrace?.journey ?? null;
}

export function clearPerfTraces(): void {
  activeTrace = null;
  traceRing = [];
  persistTraces();
  notify();
}

export function startJourney(
  journey: PerfJourneyId,
  trigger: string,
  options?: { startedAt?: number }
): void {
  if (!isPerfEnabled()) return;

  if (activeTrace) {
    finalizeActive("abandoned");
  }

  const startedAt = options?.startedAt ?? now();

  activeTrace = {
    id: traceId(),
    journey,
    trigger,
    startedAt,
    pathAtStart: pathAtStart(),
    marks: [],
    serverPhases: [],
    headlineMs: null,
    headlinePhase: null,
    status: "active",
    completedAt: null,
  };

  emitUserTimingMark(journey, "start");
  notify();
}

function resolveMarkTarget(): PerfTrace | null {
  if (activeTrace) return activeTrace;
  const latest = traceRing[0];

  return latest?.status === "complete" ? latest : null;
}

export function mark(name: string, detail?: Record<string, unknown>): void {
  if (!isPerfEnabled()) return;

  const target = resolveMarkTarget();

  if (!target) return;

  const t = now() - target.startedAt;

  target.marks.push({ name, t, detail });
  emitUserTimingMark(target.journey, name);
  notify();
}

/** Record a mark at an absolute performance.now() offset from navigation start. */
export function markAt(name: string, absoluteMs: number, detail?: Record<string, unknown>): void {
  if (!isPerfEnabled()) return;

  const target = resolveMarkTarget();

  if (!target) return;

  const t = absoluteMs - target.startedAt;

  target.marks.push({ name, t, detail });
  emitUserTimingMark(target.journey, name);
  notify();
}

export function completeForJourney(
  expected: PerfJourneyId | PerfJourneyId[],
  name: string,
  detail?: Record<string, unknown>
): void {
  if (!isPerfEnabled() || !activeTrace) return;

  const allowed = Array.isArray(expected) ? expected : [expected];

  if (!allowed.includes(activeTrace.journey)) return;

  complete(name, detail);
}

export function complete(name: string, detail?: Record<string, unknown>): void {
  if (!isPerfEnabled() || !activeTrace) return;

  const t = now() - activeTrace.startedAt;

  activeTrace.marks.push({ name, t, detail });
  activeTrace.headlineMs = t;
  activeTrace.headlinePhase = name;
  activeTrace.status = "complete";
  activeTrace.completedAt = now();

  emitUserTimingMark(activeTrace.journey, name);
  emitUserTimingMeasure(activeTrace);
  logCompletion(activeTrace);

  traceRing = [activeTrace, ...traceRing.filter((tr) => tr.id !== activeTrace!.id)].slice(
    0,
    MAX_TRACES
  );
  persistTraces();
  activeTrace = null;
  notify();
}

export function addServerPhases(phases: Array<{ name: string; ms: number }>): void {
  if (!isPerfEnabled() || phases.length === 0) return;

  const target = activeTrace ?? traceRing[0];

  if (!target) return;

  for (const phase of phases) {
    const existing = target.serverPhases.find((p) => p.name === phase.name);

    if (existing) {
      existing.ms = phase.ms;
    } else {
      target.serverPhases.push({ name: phase.name, ms: phase.ms, source: "server" });
    }
  }

  persistTraces();
  notify();
}
