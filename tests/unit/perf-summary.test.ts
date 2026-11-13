import { describe, expect, mock, test } from "bun:test";

import {
  isP95Reliable,
  isP99Reliable,
  loadPerfSummary,
  parsePerfRange,
  perfVerdict,
  reliableDailyP95,
  type PerfSummaryRow,
} from "@/lib/perf/summary-core";

const row = (overrides: Partial<PerfSummaryRow> = {}): PerfSummaryRow => ({
  journey: "to-chat",
  phase: "chat:ready",
  kind: "journey",
  route: "/chat/[id]",
  device: "desktop",
  samples: 500,
  p50: 120,
  p75: 160,
  p95: 220,
  p99: 240,
  withinBudget: 0.99,
  ...overrides,
});

function client(summary: unknown, daily: unknown = { data: [], error: null }) {
  return {
    rpc: mock(async (fn: string) => (fn === "perf_summary" ? summary : daily)) as never,
  };
}

describe("parsePerfRange", () => {
  test("defaults to 7 days and only accepts known windows", () => {
    expect(parsePerfRange(undefined)).toBe("7d");
    expect(parsePerfRange("24h")).toBe("24h");
    expect(parsePerfRange("30d")).toBe("30d");
    expect(parsePerfRange("1000y")).toBe("7d");
    expect(parsePerfRange("'; drop table")).toBe("7d");
  });
});

describe("perfVerdict: never claims more than the sample count supports", () => {
  test("reliability thresholds", () => {
    expect(isP95Reliable(19)).toBe(false);
    expect(isP95Reliable(20)).toBe(true);
    expect(isP99Reliable(99)).toBe(false);
    expect(isP99Reliable(100)).toBe(true);
  });

  test("judges at p99 with enough samples, p95 with fewer, and abstains below that", () => {
    expect(perfVerdict(row({ samples: 100, p99: 240 }))).toEqual({ level: "p99", pass: true });
    expect(perfVerdict(row({ samples: 100, p99: 251 }))).toEqual({ level: "p99", pass: false });
    expect(perfVerdict(row({ samples: 40, p95: 200, p99: 900 }))).toEqual({ level: "p95", pass: true });
    expect(perfVerdict(row({ samples: 40, p95: 260 }))).toEqual({ level: "p95", pass: false });
    expect(perfVerdict(row({ samples: 5, p95: 10, p99: 10 }))).toEqual({ level: "none", pass: null });
  });
});

describe("loadPerfSummary", () => {
  const goodRow = {
    journey: "to-chat", phase: "chat:ready", kind: "journey", route: "/chat/[id]", device: "desktop",
    samples: "42", p50: "100.5", p75: "130", p95: "200", p99: "230", within_budget: "0.97",
  };

  test("maps aggregate rows, coercing numerics", async () => {
    const result = await loadPerfSummary(
      client({ data: [goodRow], error: null }),
      "7d",
      Date.parse("2026-11-12T00:00:00.000Z")
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.since).toBe("2026-11-05T00:00:00.000Z");
    expect(result.rows).toEqual([
      { journey: "to-chat", phase: "chat:ready", kind: "journey", route: "/chat/[id]", device: "desktop",
        samples: 42, p50: 100.5, p75: 130, p95: 200, p99: 230, withinBudget: 0.97 },
    ]);
  });

  test("drops any row that is not a closed-list aggregate, so nothing odd can render", async () => {
    const result = await loadPerfSummary(
      client({
        data: [
          goodRow,
          { ...goodRow, route: "/chat/3f2b8c1e-9d4a-4e7b-8a61-0c5d2e9f7a13" },
          { ...goodRow, journey: "made-up" },
          { ...goodRow, p95: "not a number" },
          "garbage",
          null,
        ],
        error: null,
      }),
      "24h"
    );

    expect(result.status === "ok" && result.rows).toHaveLength(1);
  });

  test("a missing function or table reads as pending, other errors as error", async () => {
    for (const code of ["42883", "42P01", "PGRST202", "PGRST205"]) {
      expect(await loadPerfSummary(client({ data: null, error: { code } }), "7d")).toEqual({ status: "pending" });
    }
    expect(await loadPerfSummary(client({ data: null, error: { code: "XX000" } }), "7d")).toEqual({ status: "error" });
  });
});

describe("reliableDailyP95", () => {
  test("a day with too few samples is a gap, not a point", () => {
    const out = reliableDailyP95(
      [
        { day: "2026-11-12", journey: "load", samples: 5, p50: 900, p95: 3800 },
        { day: "2026-11-11", journey: "load", samples: 40, p50: 300, p95: 700 },
        { day: "2026-11-11", journey: "to-chat", samples: 40, p50: 1, p95: 2 },
      ],
      "load"
    );

    expect(out).toEqual([
      { day: "2026-11-11", p50: 300, p95: 700, samples: 40 },
      { day: "2026-11-12", p50: 900, p95: null, samples: 5 },
    ]);
  });
});
