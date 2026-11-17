import { describe, expect, mock, test } from "bun:test";

import { createTokenAnalyticsHandler } from "@/lib/api/admin-token-analytics-handler";
import { cacheRate, groupTokens, tokenTotals, type TokenBucket } from "@/lib/usage/token-analytics";
import { chatUsageSurface, operationUsageSurface } from "@/lib/usage/surfaces";

const row = (input: number, cached: number, unknown = 0): TokenBucket => ({
  day: "2026-11-13",
  surface: "stage",
  model: "model",
  operation: "chat",
  input,
  cached,
  uncached: input - cached - unknown,
  unknown,
  output: 10,
  calls: 1,
});
describe("admin token analytics", () => {
  test("weights by input and excludes unknown telemetry from the cache denominator", () => {
    const totals = tokenTotals([row(100, 100), row(900, 0), row(1000, 0, 1000)]);
    expect(cacheRate(totals)).toBe(0.1);
    expect(totals.unknown).toBe(1000);
    expect(cacheRate(tokenTotals([]))).toBeNull();
    expect(cacheRate(row(100, 0, 100))).toBeNull();
  });
  test("surface/model/day grouping reconciles without counting output as input", () => {
    const rows = [row(100, 20), { ...row(200, 100), surface: "arcadia", model: "other" }];
    for (const dimension of ["surface", "model", "day", "operation"] as const) {
      expect(tokenTotals(groupTokens(rows, dimension))).toEqual(tokenTotals(rows));
    }
    expect(tokenTotals(rows).input).toBe(300);
  });
  test("maps explicit chat experiences and leaves ambiguous workers unclassified", () => {
    expect(chatUsageSurface("strata_page")).toBe("stage");
    expect(chatUsageSurface("arcadia")).toBe("arcadia");
    expect(chatUsageSurface("rabbit_hole")).toBe("rabbit_holes");
    expect(chatUsageSurface()).toBe("chat");
    expect(operationUsageSurface("subagent_worker", "/api/chat/queue")).toBe("unknown");
  });
  test("rejects non-admins before reading telemetry", async () => {
    const read = mock(async () => []);
    const handler = createTokenAnalyticsHandler({ requireAdmin: async () => null, read });
    expect((await handler(new Request("https://app.test/api?days=7"))).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
  });
  test("derives owner server-side, bounds UTC days and rejects owner/all-user overrides", async () => {
    const read = mock(async (..._args: string[]) => []);
    const handler = createTokenAnalyticsHandler({
      requireAdmin: async () => ({ sbUserId: "owner", clerkUserId: "clerk" }),
      read,
      now: () => new Date("2026-11-13T12:30:00Z"),
    });
    const response = await handler(new Request("https://app.test/api?days=7"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(read).toHaveBeenCalledWith(
      "owner",
      "2026-11-07T00:00:00.000Z",
      "2026-11-13T12:30:00.000Z"
    );
    for (const query of ["days=1000", "ownerId=someone", "scope=all"]) {
      expect((await handler(new Request(`https://app.test/api?${query}`))).status).toBe(400);
    }
  });
  test("database failure cannot masquerade as empty usage", async () => {
    const handler = createTokenAnalyticsHandler({
      requireAdmin: async () => ({ sbUserId: "owner", clerkUserId: "clerk" }),
      read: async () => {
        throw new Error("database");
      },
    });
    expect((await handler(new Request("https://app.test/api"))).status).toBe(503);
  });
});
