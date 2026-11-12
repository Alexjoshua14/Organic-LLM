import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import "../helpers/render";

import { setPerfConsentOn, setPerfSessionAllowed } from "@/lib/perf/enabled";
import { PerfBatchSchema } from "@/lib/perf/events";
import {
  clearPerfReportQueue,
  flushPerfReports,
  reportPerfTrace,
  toPerfEvents,
  type PerfReportContext,
} from "@/lib/perf/report";
import type { PerfTrace } from "@/lib/perf/trace-store";

const THREAD_ID = "3f2b8c1e-9d4a-4e7b-8a61-0c5d2e9f7a13";

const ctx: PerfReportContext = {
  pathname: `/chat/${THREAD_ID}`,
  device: "desktop",
  conn: "4g",
  build: "0.12.3",
};

function trace(overrides: Partial<PerfTrace> = {}): PerfTrace {
  return {
    id: "1-abc",
    journey: "to-chat",
    trigger: `link:/chat/${THREAD_ID}`,
    startedAt: 100,
    pathAtStart: `/chat/${THREAD_ID}`,
    marks: [
      { name: "nav:push", t: 12.4, detail: { path: `/chat/${THREAD_ID}`, threadId: THREAD_ID } },
      { name: "chat:ready", t: 184.6, detail: { experience: "chat" } },
      { name: "something:unlisted", t: 5 },
      { name: `custom:${THREAD_ID}`, t: 6 },
      { name: "nav:push", t: 99 },
    ],
    serverPhases: [
      { name: "loadChat", ms: 61.2, source: "server" },
      { name: "secret-phase", ms: 3, source: "server" },
    ],
    headlineMs: 184.6,
    headlinePhase: "chat:ready",
    status: "complete",
    completedAt: 285,
    ...overrides,
  };
}

describe("toPerfEvents", () => {
  test("builds the headline plus allow-listed steps, rounded, from the destination route", () => {
    const events = toPerfEvents(trace(), ctx);

    expect(events[0]).toMatchObject({
      kind: "journey",
      journey: "to-chat",
      phase: "chat:ready",
      route: "/chat/[id]",
      trigger: "link",
      ms: 185,
    });
    expect(events.map((e) => `${e.kind}:${e.phase}`)).toEqual([
      "journey:chat:ready",
      "phase:nav:push",
      "phase:chat:ready",
      "phase:loadChat",
    ]);
    // A repeated step is reported once; the first reading wins.
    expect(events.find((e) => e.phase === "nav:push")?.ms).toBe(12);
  });

  test("no identifier from the trace can appear in what would be sent", () => {
    const body = JSON.stringify(toPerfEvents(trace(), ctx));

    expect(body).not.toContain(THREAD_ID);
    expect(body).not.toContain("secret-phase");
    expect(body).not.toContain("custom:");
    expect(body).not.toContain("threadId");
    expect(body).not.toContain("detail");
  });

  test("everything produced passes the server's strict schema", () => {
    expect(PerfBatchSchema.safeParse({ events: toPerfEvents(trace(), ctx) }).success).toBe(true);
  });

  test("only completed traces with a headline are reported, and timings are clamped", () => {
    expect(toPerfEvents(trace({ status: "abandoned" }), ctx)).toEqual([]);
    expect(toPerfEvents(trace({ headlineMs: null }), ctx)).toEqual([]);
    // An unlisted headline phase loses only the headline event; listed steps still go out.
    expect(
      toPerfEvents(trace({ headlinePhase: "not:a:phase" }), ctx).some((e) => e.kind === "journey")
    ).toBe(false);

    const slow = toPerfEvents(trace({ headlineMs: 9_999_999 }), ctx);

    expect(slow[0].ms).toBe(120_000);
  });
});

describe("reportPerfTrace: sending is gated on consent", () => {
  const sendBeacon = mock((_url: string, _body: Blob) => true);

  beforeEach(() => {
    sendBeacon.mockClear();
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    window.history.replaceState(null, "", `/chat/${THREAD_ID}`);
    setPerfSessionAllowed(true);
    clearPerfReportQueue();
  });

  afterEach(() => {
    setPerfConsentOn(false);
    setPerfSessionAllowed(false);
    clearPerfReportQueue();
  });

  test("without consent nothing is queued or sent", () => {
    setPerfConsentOn(false);
    reportPerfTrace(trace());
    flushPerfReports();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  test("with consent, one beacon carries only validated, id-free events", async () => {
    setPerfConsentOn(true);
    reportPerfTrace(trace());
    flushPerfReports();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    const text = await blob.text();

    expect(url).toBe("/api/perf/ingest");
    expect(text).not.toContain(THREAD_ID);
    expect(PerfBatchSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });

  test("turning consent off before the flush drops what was waiting", () => {
    setPerfConsentOn(true);
    reportPerfTrace(trace());
    setPerfConsentOn(false);
    flushPerfReports();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  test("a signed-out session reports nothing even with a stale consent flag", () => {
    setPerfConsentOn(true);
    setPerfSessionAllowed(false);
    reportPerfTrace(trace());
    flushPerfReports();
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
