import { describe, expect, mock, test } from "bun:test";
import { createUsageResetHandler } from "@/lib/api/usage-reset-handler";
import { evaluatePlanBudget, unavailablePlanBudget } from "@/lib/plans/plan-tags";

const VERSION = "2026-10-01T12:00:00.123456+00:00";
const cycle = { start: new Date("2026-10-08"), end: new Date("2026-10-15") };
const budget = evaluatePlanBudget({
  plan: "pro",
  source: "entitlements",
  usedUsd: 25,
  cycle,
  resetsRemaining: 25,
  resetVersion: VERSION,
});
const request = (body: unknown = { resetVersion: VERSION }, headers = {}) =>
  new Request("https://organic.test/api/usage/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
function fixture() {
  const auth = mock(async () => ({ userId: "verified-clerk" as string | null }));
  const consume = mock(async () => ({
    status: "ok" as const,
    resetsRemaining: 24,
    cycleAnchor: new Date(),
  }));
  const read = mock(async () => budget);
  const handler = createUsageResetHandler({
    auth,
    getSupabaseUserId: async () => ({ data: "verified-owner", error: null }),
    consumeUsageReset: consume,
    getPlanBudgetForUser: read,
  });
  return { auth, consume, read, handler };
}
describe("usage reset authorization and retries", () => {
  test("trusted identity and the exact microsecond window version reach the atomic reset", async () => {
    const f = fixture();
    const response = await f.handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(f.consume).toHaveBeenCalledWith("verified-owner", VERSION);
    expect((await response.json()).resetApplied).toBe(true);
  });
  test("anonymous, forged-owner, malformed, and cross-origin requests cannot spend a credit", async () => {
    const f = fixture();
    f.auth.mockResolvedValueOnce({ userId: null });
    expect((await f.handler(request())).status).toBe(401);
    expect(
      (await f.handler(request({ resetVersion: VERSION, ownerId: "another-owner" }))).status
    ).toBe(400);
    expect((await f.handler(request({ resetVersion: "bad" }))).status).toBe(400);
    expect((await f.handler(request(undefined, { Origin: "https://elsewhere.test" }))).status).toBe(
      403
    );
    expect(f.consume).not.toHaveBeenCalled();
  });
  test("an unreadable ledger preserves the credit; a stale version reports a conflict", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(unavailablePlanBudget(cycle));
    expect((await f.handler(request())).status).toBe(503);
    expect(f.consume).not.toHaveBeenCalled();
    f.consume.mockImplementation(async () => ({ status: "conflict" }) as never);
    expect((await f.handler(request())).status).toBe(409);
  });
});
