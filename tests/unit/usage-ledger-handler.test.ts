import { describe, expect, mock, test } from "bun:test";

import { createUsageLedgerHandlers } from "@/lib/api/usage-ledger-handler";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const adjustment = { id: ID, ownerId: OWNER, deltaUsd: -1.25, reason: "Duplicate charge" };
const request = (body: unknown, headers = {}) =>
  new Request("https://organic.test/api/admin/usage-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
function fixture(admin = true) {
  const read = mock(async () => ({ charges: [], adjustments: [] }));
  const append = mock(async () => ({ id: ID }));
  return {
    read,
    append,
    handlers: createUsageLedgerHandlers({
      requireAdmin: async () => (admin ? { clerkUserId: "verified_admin", sbUserId: ACTOR } : null),
      read,
      append,
    }),
  };
}

describe("usage ledger administration", () => {
  test("non-admins cannot review or correct any account", async () => {
    const f = fixture(false);
    expect(
      (await f.handlers.GET(new Request(`https://organic.test?ownerId=${OWNER}`))).status
    ).toBe(403);
    expect((await f.handlers.POST(request(adjustment))).status).toBe(403);
    expect(f.read).not.toHaveBeenCalled();
    expect(f.append).not.toHaveBeenCalled();
  });
  test("the correction actor comes from trusted admin context", async () => {
    const f = fixture();
    expect((await f.handlers.POST(request(adjustment))).status).toBe(200);
    expect(f.append).toHaveBeenCalledWith({ ...adjustment, eventId: null, actorId: ACTOR });
    expect((await f.handlers.POST(request({ ...adjustment, actorId: OWNER }))).status).toBe(400);
    expect(
      (await f.handlers.POST(request({ ...adjustment, effectiveAt: "2020-01-01" }))).status
    ).toBe(400);
  });
  test("invalid money, missing reasons, and cross-origin submissions do not write", async () => {
    const f = fixture();
    for (const deltaUsd of [0, Infinity, 0.0000001, -100001]) {
      expect((await f.handlers.POST(request({ ...adjustment, deltaUsd }))).status).toBe(400);
    }
    expect((await f.handlers.POST(request({ ...adjustment, reason: " " }))).status).toBe(400);
    expect(
      (await f.handlers.POST(request(adjustment, { Origin: "https://elsewhere.test" }))).status
    ).toBe(403);
    expect(f.append).not.toHaveBeenCalled();
  });
  test("history has bounded pagination; outages are explicit", async () => {
    const f = fixture();
    expect(
      (await f.handlers.GET(new Request(`https://organic.test?ownerId=${OWNER}&offset=100`))).status
    ).toBe(200);
    expect(f.read).toHaveBeenCalledWith(OWNER, 100);
    for (const offset of ["-1", "1.5", "Infinity", "1000001"]) {
      expect(
        (
          await f.handlers.GET(
            new Request(`https://organic.test?ownerId=${OWNER}&offset=${offset}`)
          )
        ).status
      ).toBe(400);
    }
    f.read.mockImplementation(async () => {
      throw new Error("database down");
    });
    expect(
      (await f.handlers.GET(new Request(`https://organic.test?ownerId=${OWNER}`))).status
    ).toBe(503);
  });
});
