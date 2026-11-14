import type { PerfJourneyId } from "./journeys";

import { PERF_DURATIONS, PERF_PHASES } from "./journeys";
import { classifyResource, type PerfResourceCategory } from "./resource-category";

/**
 * Turns the browser's own timing entries into the durations a finished journey reports. The
 * computing functions are pure (entries in, `{ name, ms }[]` out) so they can be tested without a
 * browser; only the observer setup at the bottom touches `window`. Request URLs are read here to
 * pick a category and never leave this module.
 */

export type PerfDurationValue = { name: string; ms: number };

/** The subset of PerformanceResourceTiming that is read. */
export type ResourceLike = {
  name: string;
  startTime: number;
  responseEnd: number;
  requestStart?: number;
  responseStart?: number;
};

type Interval = readonly [number, number];

/** Total time covered by the intervals, overlap counted once. */
export function unionMs(intervals: readonly Interval[]): number {
  const sorted = intervals
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .slice()
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curStart = 0;
  let curEnd = -Infinity;

  for (const [a, b] of sorted) {
    if (a > curEnd) {
      if (curEnd > -Infinity) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) {
      curEnd = b;
    }
  }
  if (curEnd > -Infinity) total += curEnd - curStart;

  return total;
}

const CATEGORY_PHASE: Partial<Record<PerfResourceCategory, string>> = {
  font: PERF_DURATIONS.resFont,
  script: PERF_DURATIONS.resScript,
  css: PERF_DURATIONS.resCss,
  clerk: PERF_DURATIONS.resClerk,
  rsc: PERF_DURATIONS.resRsc,
  "third-party": PERF_DURATIONS.resThirdParty,
  "api-stream-resume": PERF_DURATIONS.apiStreamResume,
  "api-messages": PERF_DURATIONS.apiMessages,
  "api-sidebar": PERF_DURATIONS.apiSidebar,
  "api-usage": PERF_DURATIONS.apiUsage,
  "api-other": PERF_DURATIONS.apiOther,
};

const round = (n: number) => Math.max(0, Math.round(n));

/**
 * Time with at least one request of each kind in flight, between `from` and `to`, plus the time
 * with any request in flight. A kind with no request in the window is simply absent, not 0.
 */
export function resourceDurations(
  entries: readonly ResourceLike[],
  window: { from: number; to: number },
  origin: string
): PerfDurationValue[] {
  const byPhase = new Map<string, Interval[]>();
  const all: Interval[] = [];

  for (const e of entries) {
    if (
      !(e.startTime >= window.from) ||
      !(e.responseEnd > e.startTime) ||
      e.responseEnd > window.to
    ) {
      continue;
    }
    const category = classifyResource(e.name, origin);
    const phase = CATEGORY_PHASE[category];
    const interval: Interval = [e.startTime, e.responseEnd];

    all.push(interval);
    if (phase) byPhase.set(phase, [...(byPhase.get(phase) ?? []), interval]);
  }

  const out: PerfDurationValue[] = [];

  for (const [name, intervals] of byPhase) out.push({ name, ms: round(unionMs(intervals)) });
  if (all.length > 0) out.push({ name: PERF_DURATIONS.netBusy, ms: round(unionMs(all)) });

  return out;
}

/** Marks the timeline needs from a trace, relative to the journey start. */
export type SegmentInput = {
  journey: PerfJourneyId;
  /** performance.now() when the journey started. */
  startedAt: number;
  headlineMs: number;
  marks: ReadonlyArray<{ name: string; t: number }>;
};

const SEGMENT_JOURNEYS: readonly PerfJourneyId[] = ["thread-switch", "to-chat", "to-arcadia"];

/**
 * Splits "click to ready" into five back-to-back segments that add up to the whole: click to the
 * page-payload request, waiting for the first byte, downloading, committing the route, and
 * rendering to ready. They come from the page-payload request's own timing. If that request is
 * not in the window (a prefetch or cache hit, or a full buffer) nothing is reported rather than a
 * guess. With a streamed payload the server's work lands in "downloading".
 */
export function journeySegments(
  input: SegmentInput,
  entries: readonly ResourceLike[],
  origin: string
): PerfDurationValue[] {
  if (!SEGMENT_JOURNEYS.includes(input.journey)) return [];

  const end = input.startedAt + input.headlineMs;
  let payload: ResourceLike | null = null;

  for (const e of entries) {
    if (e.startTime < input.startedAt || e.responseEnd > end + 5) continue;
    if (classifyResource(e.name, origin) !== "rsc") continue;
    if (!payload || e.responseEnd > payload.responseEnd) payload = e;
  }
  if (!payload || !(payload.responseStart && payload.responseStart >= payload.startTime)) return [];

  const rel = (abs: number) => abs - input.startedAt;
  const committed = input.marks.find((m) => m.name === PERF_PHASES.navCommitted)?.t;
  const p1 = Math.max(0, rel(payload.startTime));
  const p2 = Math.max(p1, rel(payload.responseStart));
  const p3 = Math.max(p2, rel(payload.responseEnd));
  const p4 = committed === undefined ? p3 : Math.max(p3, committed);
  const p5 = Math.max(p4, input.headlineMs);

  return [
    { name: PERF_DURATIONS.segInput, ms: round(p1) },
    { name: PERF_DURATIONS.segServer, ms: round(p2 - p1) },
    { name: PERF_DURATIONS.segDownload, ms: round(p3 - p2) },
    ...(committed === undefined ? [] : [{ name: PERF_DURATIONS.segCommit, ms: round(p4 - p3) }]),
    { name: PERF_DURATIONS.segRender, ms: round(p5 - p4) },
  ];
}

/** The subset of PerformanceNavigationTiming that is read. */
export type NavigationLike = {
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
};

/**
 * The document request, split into DNS, connection (TLS included), waiting for the server, and
 * download. DNS and connection are reported only when a lookup or connection actually happened:
 * a reused connection has no such step to time.
 */
export function navigationDurations(nav: NavigationLike): PerfDurationValue[] {
  const out: PerfDurationValue[] = [];
  const dns = nav.domainLookupEnd - nav.domainLookupStart;
  const connect = nav.connectEnd - nav.connectStart;

  if (dns > 0) out.push({ name: PERF_DURATIONS.loadDns, ms: round(dns) });
  if (connect > 0) out.push({ name: PERF_DURATIONS.loadConnect, ms: round(connect) });
  if (nav.responseStart >= nav.requestStart && nav.requestStart > 0) {
    out.push({ name: PERF_DURATIONS.loadServer, ms: round(nav.responseStart - nav.requestStart) });
  }
  if (nav.responseEnd >= nav.responseStart && nav.responseStart > 0) {
    out.push({ name: PERF_DURATIONS.loadDownload, ms: round(nav.responseEnd - nav.responseStart) });
  }

  return out;
}

/**
 * Largest Contentful Paint split into where the time went: waiting for the resource to start
 * loading, loading it, and waiting to render it. A text LCP (no resource) has only the render
 * delay. `responseStart` is the document's first byte.
 */
export function lcpDurations(
  lcp: { startTime: number; url?: string } | null,
  ttfb: number,
  entries: readonly ResourceLike[]
): PerfDurationValue[] {
  if (!lcp || !(lcp.startTime > 0)) return [];

  const resource = lcp.url ? entries.find((e) => e.name === lcp.url) : undefined;

  if (!resource) {
    return [{ name: PERF_DURATIONS.lcpRenderDelay, ms: round(lcp.startTime - ttfb) }];
  }

  return [
    { name: PERF_DURATIONS.lcpLoadDelay, ms: round(resource.startTime - ttfb) },
    { name: PERF_DURATIONS.lcpLoadTime, ms: round(resource.responseEnd - resource.startTime) },
    { name: PERF_DURATIONS.lcpRenderDelay, ms: round(lcp.startTime - resource.responseEnd) },
  ];
}

export type LongTask = { startTime: number; duration: number };

/** Time the main thread spent blocked (each long task beyond 50 ms) and the single worst task. */
export function longTaskDurations(
  tasks: readonly LongTask[],
  window: { from: number; to: number }
): PerfDurationValue[] {
  let blocking = 0;
  let longest = 0;
  let any = false;

  for (const t of tasks) {
    if (t.startTime < window.from || t.startTime + t.duration > window.to) continue;
    any = true;
    blocking += Math.max(0, t.duration - 50);
    longest = Math.max(longest, t.duration);
  }

  return any
    ? [
        { name: PERF_DURATIONS.mainBlocking, ms: round(blocking) },
        { name: PERF_DURATIONS.mainLongest, ms: round(longest) },
      ]
    : [];
}

// ---- browser side ----------------------------------------------------------------------------

const MAX_LONG_TASKS = 200;
const RESOURCE_BUFFER = 600;
let longTasks: LongTask[] = [];
let observersStarted = false;
let longTaskSupported = false;
/** Not readable from the performance timeline afterwards, so the observer keeps the latest. */
let lastLcp: { startTime: number; url?: string } | null = null;

/**
 * Starts what has to be running before a journey finishes: a larger resource-timing buffer (the
 * default holds only 250 entries) and a long-task observer. Safe to call repeatedly; does nothing
 * where an API is missing, and a missing API reports nothing rather than zero.
 */
export function initPerfObservers(): void {
  if (observersStarted || typeof window === "undefined" || typeof performance === "undefined")
    return;
  observersStarted = true;

  try {
    performance.setResourceTimingBufferSize?.(RESOURCE_BUFFER);
  } catch {
    // ignore
  }

  try {
    if (typeof PerformanceObserver !== "undefined") {
      const supported = PerformanceObserver.supportedEntryTypes ?? [];

      if (supported.includes("longtask")) {
        longTaskSupported = true;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            longTasks.push({ startTime: e.startTime, duration: e.duration });
          }
          if (longTasks.length > MAX_LONG_TASKS) longTasks = longTasks.slice(-MAX_LONG_TASKS);
        }).observe({ type: "longtask", buffered: true });
      }
      if (supported.includes("largest-contentful-paint")) {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as Array<PerformanceEntry & { url?: string }>;
          const last = entries[entries.length - 1];

          if (last) lastLcp = { startTime: last.startTime, url: last.url || undefined };
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }
    }
  } catch {
    // unsupported
  }
}

type DurationTrace = SegmentInput & { startedAt: number };

/** Everything a finished journey adds to its report, read from the browser's timing entries. */
export function collectJourneyDurations(trace: DurationTrace): PerfDurationValue[] {
  if (typeof window === "undefined" || typeof performance === "undefined") return [];

  try {
    const origin = window.location.origin;
    const window_ = { from: trace.startedAt, to: trace.startedAt + trace.headlineMs };
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const out: PerfDurationValue[] = [
      ...resourceDurations(resources, window_, origin),
      ...journeySegments(trace, resources, origin),
    ];

    if (longTaskSupported) out.push(...longTaskDurations(longTasks, window_));

    if (trace.journey === "load") {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;

      if (nav) {
        out.push(...navigationDurations(nav));
        out.push(...lcpDurations(lastLcp, nav.responseStart, resources));
      }
    }

    return out;
  } catch {
    return [];
  }
}

/** Test seam. */
export function resetPerfObserversForTest(): void {
  longTasks = [];
  observersStarted = false;
  longTaskSupported = false;
  lastLcp = null;
}
