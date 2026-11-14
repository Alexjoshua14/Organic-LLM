"use client";

import type { PerfTrace } from "./trace-store";

import {
  PERF_BUILD_PATTERN,
  PERF_MAX_EVENTS_PER_BATCH,
  PERF_MAX_MS,
  PERF_REPORTABLE_PHASES,
  PerfEventSchema,
  perfRouteTemplate,
  perfTriggerKind,
  type PerfConnection,
  type PerfDevice,
  type PerfEvent,
} from "./events";
import { isPerfReportingAllowed } from "./enabled";

/**
 * Sends finished journeys to the server as anonymous timings. Everything leaving the browser is
 * built here from the allow-listed fields in `events.ts`; mark `detail` objects, raw paths and
 * trigger strings are never read. The reporter does nothing on the interaction path: it runs
 * after a journey has already completed, never throws, and sends in batches when the tab hides.
 */

const INGEST_URL = "/api/perf/ingest";
const MAX_QUEUE = 400;
const IDLE_FLUSH_MS = 30_000;

export type PerfReportContext = {
  /** `location.pathname` at completion — the destination, templated before use. */
  pathname: string;
  device: PerfDevice;
  conn: PerfConnection;
  build: string;
};

const clampMs = (value: number) => Math.min(PERF_MAX_MS, Math.max(0, Math.round(value)));

/** Pure: a completed trace → the validated events that may be sent. */
export function toPerfEvents(trace: PerfTrace, ctx: PerfReportContext): PerfEvent[] {
  if (trace.status !== "complete" || trace.headlineMs == null || trace.headlinePhase == null) {
    return [];
  }
  // A journey that ran in a hidden tab, or went stale, measures the browser rather than the app.
  if (trace.tainted) return [];

  const base = {
    journey: trace.journey,
    route: perfRouteTemplate(ctx.pathname),
    trigger: perfTriggerKind(trace.trigger),
    device: ctx.device,
    conn: ctx.conn,
    build: ctx.build,
  } as const;
  const candidates: unknown[] = [
    { ...base, kind: "journey", phase: trace.headlinePhase, ms: clampMs(trace.headlineMs) },
  ];
  const seen = new Set<string>();

  for (const m of trace.marks) {
    if (seen.has(m.name) || !PERF_REPORTABLE_PHASES.includes(m.name) || !Number.isFinite(m.t)) {
      continue;
    }
    seen.add(m.name);
    candidates.push({ ...base, kind: "phase", phase: m.name, ms: clampMs(m.t) });
  }

  for (const phase of trace.serverPhases) {
    if (seen.has(phase.name) || !PERF_REPORTABLE_PHASES.includes(phase.name)) continue;
    if (!Number.isFinite(phase.ms)) continue;
    seen.add(phase.name);
    candidates.push({ ...base, kind: "phase", phase: phase.name, ms: clampMs(phase.ms) });
  }

  for (const duration of trace.durations ?? []) {
    if (seen.has(duration.name) || !PERF_REPORTABLE_PHASES.includes(duration.name)) continue;
    if (!Number.isFinite(duration.ms)) continue;
    seen.add(duration.name);
    candidates.push({ ...base, kind: "phase", phase: duration.name, ms: clampMs(duration.ms) });
  }

  const events: PerfEvent[] = [];

  for (const candidate of candidates) {
    const parsed = PerfEventSchema.safeParse(candidate);

    if (parsed.success) events.push(parsed.data);
    if (events.length >= PERF_MAX_EVENTS_PER_BATCH) break;
  }

  return events;
}

function readContext(): PerfReportContext | null {
  if (typeof window === "undefined") return null;

  const rawBuild = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection;
  const effective = connection?.effectiveType;
  const conn: PerfConnection =
    effective === "slow-2g" || effective === "2g" || effective === "3g" || effective === "4g"
      ? effective
      : "unknown";

  return {
    pathname: window.location.pathname,
    device: window.matchMedia?.("(max-width: 767px)").matches ? "mobile" : "desktop",
    conn,
    build: PERF_BUILD_PATTERN.test(rawBuild) ? rawBuild : "0.0.0",
  };
}

let queue: PerfEvent[] = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function send(events: PerfEvent[]): void {
  const body = JSON.stringify({ events });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        INGEST_URL,
        new Blob([body], { type: "application/json" })
      );

      if (queued) return;
    }
    void fetch(INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Metrics are best effort; never surface a failure to the user.
  }
}

/** Sends everything queued, in batches within the server's limit. */
export function flushPerfReports(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (queue.length === 0) return;

  const pending = queue;

  queue = [];
  if (!isPerfReportingAllowed()) return;

  for (let i = 0; i < pending.length; i += PERF_MAX_EVENTS_PER_BATCH) {
    send(pending.slice(i, i + PERF_MAX_EVENTS_PER_BATCH));
  }
}

/** Drops anything waiting to be sent, e.g. the moment someone turns metrics off. */
export function clearPerfReportQueue(): void {
  queue = [];
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function ensureListeners(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPerfReports();
  });
  window.addEventListener("pagehide", flushPerfReports);
}

/** Called once per completed journey. Cheap, synchronous, and silent on any failure. */
export function reportPerfTrace(trace: PerfTrace): void {
  try {
    if (!isPerfReportingAllowed()) return;

    const ctx = readContext();

    if (!ctx) return;

    const events = toPerfEvents(trace, ctx);

    if (events.length === 0) return;

    queue = [...queue, ...events].slice(-MAX_QUEUE);
    ensureListeners();
    idleTimer ??= setTimeout(flushPerfReports, IDLE_FLUSH_MS);
  } catch {
    // Metrics are best effort.
  }
}
