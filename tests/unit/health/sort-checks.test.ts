import { describe, expect, test } from "bun:test";

import { sortChecksBySeverity } from "@/lib/health/sort-checks";
import type { HealthCheckResult } from "@/lib/health/types";

function check(id: string, status: HealthCheckResult["status"]): HealthCheckResult {
  return {
    id,
    displayName: id,
    status,
    latencyMs: null,
    summary: status,
  };
}

describe("sortChecksBySeverity", () => {
  test("orders down before degraded before skipped before ok", () => {
    const sorted = sortChecksBySeverity([
      check("ollama", "ok"),
      check("memory", "down"),
      check("upstash", "skipped"),
      check("supabase", "degraded"),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["memory", "supabase", "upstash", "ollama"]);
  });
});
