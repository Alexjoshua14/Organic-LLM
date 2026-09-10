import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import { setPerfEnabled } from "@/lib/perf/enabled";
import {
  clearPerfTraces,
  complete,
  completeForJourney,
  getPerfSnapshot,
  initPerfTraceStore,
  mark,
  startJourney,
} from "@/lib/perf/trace-store";

describe("perf trace store", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPerfEnabled(true);
    clearPerfTraces();
    initPerfTraceStore();
  });

  afterEach(() => {
    setPerfEnabled(false);
    clearPerfTraces();
  });

  test("no-ops when perf is disabled", () => {
    setPerfEnabled(false);
    startJourney("load", "test");
    mark("home:shell-mounted");
    complete("home:composer-ready");

    expect(getPerfSnapshot().traces).toHaveLength(0);
    expect(getPerfSnapshot().active).toBeNull();
  });

  test("startJourney, mark, and complete record a trace", () => {
    startJourney("to-chat", "lets-chat");
    mark("chat:created");
    complete("chat:ready");

    const { traces, active } = getPerfSnapshot();

    expect(active).toBeNull();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.journey).toBe("to-chat");
    expect(traces[0]?.trigger).toBe("lets-chat");
    expect(traces[0]?.status).toBe("complete");
    expect(traces[0]?.headlinePhase).toBe("chat:ready");
    expect(traces[0]?.headlineMs).not.toBeNull();
    expect(traces[0]?.marks.map((m) => m.name)).toContain("chat:created");
    expect(traces[0]?.marks.map((m) => m.name)).toContain("chat:ready");
  });

  test("new startJourney abandons the previous active trace", () => {
    startJourney("to-chat", "first");
    startJourney("to-arcadia", "second");

    const { traces } = getPerfSnapshot();

    expect(traces).toHaveLength(1);
    expect(traces[0]?.status).toBe("abandoned");
    expect(getPerfSnapshot().active?.journey).toBe("to-arcadia");
  });

  test("late marks attach to completed trace until next startJourney", () => {
    startJourney("load", "document:/");
    complete("home:composer-ready");
    mark("chrome:first-frame");

    const { traces } = getPerfSnapshot();

    expect(traces[0]?.marks.map((m) => m.name)).toContain("chrome:first-frame");
  });

  test("ring buffer caps at 20 traces", () => {
    for (let i = 0; i < 22; i++) {
      startJourney("load", `run-${i}`);
      complete("home:composer-ready");
    }

    expect(getPerfSnapshot().traces.length).toBeLessThanOrEqual(20);
  });

  test("completeForJourney ignores wrong active journey", () => {
    startJourney("load", "document:/");
    completeForJourney("to-chat", "chat:ready");

    expect(getPerfSnapshot().active?.journey).toBe("load");
    expect(getPerfSnapshot().active?.headlineMs).toBeNull();
  });

  test("getPerfSnapshot returns stable reference until state changes", () => {
    const a = getPerfSnapshot();
    const b = getPerfSnapshot();

    expect(a).toBe(b);

    startJourney("load", "document:/");
    const c = getPerfSnapshot();

    expect(c).not.toBe(a);
  });

  test("persists traces to sessionStorage", () => {
    startJourney("to-chat", "lets-chat");
    complete("chat:ready");

    const raw = sessionStorage.getItem("ol:perf-traces");

    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Array<{ journey: string }>;

    expect(parsed[0]?.journey).toBe("to-chat");
  });
});
