import { describe, expect, test } from "bun:test";

import {
  journeySegments,
  lcpDurations,
  longTaskDurations,
  navigationDurations,
  resourceDurations,
  unionMs,
  type ResourceLike,
} from "@/lib/perf/measure";
import { isPerfDuration, PERF_DURATIONS } from "@/lib/perf/journeys";
import { PERF_REPORTABLE_PHASES } from "@/lib/perf/events";

const ORIGIN = "https://app.example.test";
const r = (path: string, startTime: number, responseEnd: number, extra: Partial<ResourceLike> = {}) =>
  ({ name: `${ORIGIN}${path}`, startTime, responseEnd, ...extra }) as ResourceLike;
const get = (list: { name: string; ms: number }[], name: string) =>
  list.find((d) => d.name === name)?.ms;

describe("unionMs", () => {
  test("counts overlap once and ignores empty or inverted spans", () => {
    expect(unionMs([[0, 100], [50, 150], [200, 250]])).toBe(200);
    expect(unionMs([[10, 10], [30, 20]])).toBe(0);
    expect(unionMs([])).toBe(0);
  });
});

describe("resourceDurations", () => {
  const fonts = [
    r("/_next/static/media/a.woff2", 100, 300),
    r("/_next/static/media/b.woff2", 150, 400),
    r("/_next/static/media/c.woff2", 600, 650),
  ];

  test("reports time with a request of each kind in flight, overlap counted once", () => {
    const out = resourceDurations(
      [...fonts, r("/_next/static/chunks/x.js", 0, 100)],
      { from: 0, to: 1000 },
      ORIGIN
    );

    expect(get(out, PERF_DURATIONS.resFont)).toBe(350); // 100..400 + 600..650
    expect(get(out, PERF_DURATIONS.resScript)).toBe(100);
    expect(get(out, PERF_DURATIONS.netBusy)).toBe(450); // 0..400 + 600..650
  });

  test("ignores requests outside the journey window and reports nothing for a missing kind", () => {
    const out = resourceDurations(fonts, { from: 500, to: 1000 }, ORIGIN);

    expect(get(out, PERF_DURATIONS.resFont)).toBe(50);
    expect(get(out, PERF_DURATIONS.resScript)).toBeUndefined();
  });

  test("only names from the closed list come out, whatever the URLs contained", () => {
    const uuid = "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
    const out = resourceDurations(
      [
        r(`/api/chat/${uuid}/stream`, 10, 90),
        r(`/chat/${uuid}?_rsc=abc`, 20, 80),
        { name: `https://tracker.test/${uuid}?e=a@b.c`, startTime: 5, responseEnd: 50 },
      ],
      { from: 0, to: 200 },
      ORIGIN
    );

    expect(out.length).toBeGreaterThan(0);
    for (const d of out) {
      expect(PERF_REPORTABLE_PHASES).toContain(d.name);
      expect(d.name).not.toContain(uuid);
      expect(isPerfDuration(d.name)).toBe(true);
    }
  });
});

describe("journeySegments", () => {
  const rsc = r("/chat/abc?_rsc=1", 120, 700, { requestStart: 125, responseStart: 400 });
  const input = (over = {}) => ({
    journey: "thread-switch" as const,
    startedAt: 100,
    headlineMs: 1000,
    marks: [{ name: "nav:committed", t: 640 }],
    ...over,
  });

  test("splits click-to-ready into back-to-back segments that add up to the whole", () => {
    const out = journeySegments(input(), [rsc], ORIGIN);
    const total = out.reduce((sum, d) => sum + d.ms, 0);

    expect(get(out, PERF_DURATIONS.segInput)).toBe(20);
    expect(get(out, PERF_DURATIONS.segServer)).toBe(280);
    expect(get(out, PERF_DURATIONS.segDownload)).toBe(300);
    expect(get(out, PERF_DURATIONS.segRender)).toBeGreaterThanOrEqual(0);
    expect(total).toBe(1000);
  });

  test("reports nothing, not a guess, when the page payload request is not in the window", () => {
    expect(journeySegments(input(), [], ORIGIN)).toEqual([]);
    expect(journeySegments(input(), [r("/chat/abc?_rsc=1", 50, 600)], ORIGIN)).toEqual([]);
  });

  test("only the navigation journeys have segments", () => {
    expect(journeySegments(input({ journey: "load" }), [rsc], ORIGIN)).toEqual([]);
    expect(journeySegments(input({ journey: "launcher-open" }), [rsc], ORIGIN)).toEqual([]);
  });
});

describe("navigationDurations and lcpDurations", () => {
  test("omits DNS and connection when none happened (a reused connection)", () => {
    const out = navigationDurations({
      domainLookupStart: 5,
      domainLookupEnd: 5,
      connectStart: 5,
      connectEnd: 5,
      requestStart: 10,
      responseStart: 90,
      responseEnd: 130,
    });

    expect(out.map((d) => d.name)).toEqual([PERF_DURATIONS.loadServer, PERF_DURATIONS.loadDownload]);
    expect(get(out, PERF_DURATIONS.loadServer)).toBe(80);
  });

  test("splits LCP into waiting, loading and rendering when a resource was the element", () => {
    const out = lcpDurations(
      { startTime: 900, url: `${ORIGIN}/hero.webp` },
      100,
      [r("/hero.webp", 300, 700)]
    );

    expect(get(out, PERF_DURATIONS.lcpLoadDelay)).toBe(200);
    expect(get(out, PERF_DURATIONS.lcpLoadTime)).toBe(400);
    expect(get(out, PERF_DURATIONS.lcpRenderDelay)).toBe(200);
  });

  test("a text LCP has only the render delay, and no LCP means nothing", () => {
    expect(lcpDurations({ startTime: 500 }, 100, []).map((d) => d.name)).toEqual([
      PERF_DURATIONS.lcpRenderDelay,
    ]);
    expect(lcpDurations(null, 100, [])).toEqual([]);
  });
});

describe("longTaskDurations", () => {
  test("blocking time counts only the part of each task beyond 50 ms", () => {
    const out = longTaskDurations(
      [
        { startTime: 100, duration: 120 },
        { startTime: 400, duration: 60 },
        { startTime: 5000, duration: 900 },
      ],
      { from: 0, to: 1000 }
    );

    expect(get(out, PERF_DURATIONS.mainBlocking)).toBe(80);
    expect(get(out, PERF_DURATIONS.mainLongest)).toBe(120);
  });

  test("no long tasks in the window reports nothing, not zero", () => {
    expect(longTaskDurations([], { from: 0, to: 1000 })).toEqual([]);
  });
});
