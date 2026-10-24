import { describe, expect, test } from "bun:test";

import { aggregateOverall } from "@/lib/health/aggregate-overall";
import type { HealthCheckResult } from "@/lib/health/types";

function check(status: HealthCheckResult["status"]): HealthCheckResult {
  return {
    id: "x",
    displayName: "X",
    status,
    latencyMs: null,
    summary: status,
  };
}

describe("aggregateOverall", () => {
  test("returns down when any check is down", () => {
    expect(aggregateOverall([check("ok"), check("down")])).toBe("down");
  });

  test("returns degraded when any degraded and none down", () => {
    expect(aggregateOverall([check("ok"), check("degraded")])).toBe("degraded");
  });

  test("returns ok when all ok or ok+skipped", () => {
    expect(aggregateOverall([check("ok"), check("skipped")])).toBe("ok");
  });

  test("returns skipped when all skipped", () => {
    expect(aggregateOverall([check("skipped"), check("skipped")])).toBe("skipped");
  });
});
