import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import * as supabaseAdminModule from "@/lib/supabase/supabase-admin";
import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";
import { mockModulePreservingReal } from "../helpers/module-mock";

const THREAD_ID = "3f2b8c1e-9d4a-4e7b-8a61-0c5d2e9f7a13";

const mockAuth = mock(createMockAuth());
const mockProfile = mock(async () => ({ data: "profile_1" as string | null, error: null as Error | null }));
const mockLimit = mock(async () => ({ success: true }));

type Row = Record<string, unknown>;
const db = {
  inserted: [] as Row[],
  upserts: [] as Row[],
  consent: null as { enabled: boolean } | null,
  consentError: null as { code: string } | null,
  upsertError: null as { code: string } | null,
};

const fakeAdmin = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: table === "perf_metrics_consent" ? db.consent : null,
          error: db.consentError,
        }),
      }),
    }),
    upsert: async (row: Row) => {
      db.upserts.push(row);

      return { error: db.upsertError };
    },
    insert: async (rows: Row[]) => {
      db.inserted.push(...rows);

      return { error: null };
    },
  }),
};

mock.module("@clerk/nextjs/server", () => ({ auth: mockAuth }));
mock.module("@/data/supabase/profile-id-cache", () => ({ getSupabaseUserIdCached: mockProfile }));
mock.module("@/lib/rate-limit/perf", () => ({ checkPerfLimit: mockLimit }));
const restoreAdmin = mockModulePreservingReal(
  "@/lib/supabase/supabase-admin",
  supabaseAdminModule,
  { supabaseAdmin: fakeAdmin as unknown as typeof supabaseAdminModule.supabaseAdmin }
);

afterAll(restoreAdmin);

import { clearPerfConsentCache } from "@/data/supabase/perf-metrics";
import { GET as consentGet, PUT as consentPut } from "@/app/api/perf/consent/route";
import { POST as ingest } from "@/app/api/perf/ingest/route";

const event = {
  kind: "journey",
  journey: "to-chat",
  phase: "chat:ready",
  route: "/chat/[id]",
  trigger: "sidebar-thread",
  device: "desktop",
  conn: "4g",
  build: "0.12.3",
  ms: 184,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/perf/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function put(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/perf/consent", {
    method: "PUT",
    headers: { "content-type": "application/json", host: "localhost", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  clearPerfConsentCache();
  db.inserted = [];
  db.upserts = [];
  db.consent = { enabled: true };
  db.consentError = null;
  db.upsertError = null;
  mockAuth.mockResolvedValue(createMockClerkUser());
  mockProfile.mockResolvedValue({ data: "profile_1", error: null });
  mockLimit.mockResolvedValue({ success: true });
});

describe("POST /api/perf/ingest", () => {
  test("refuses a signed-out caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect((await ingest(post({ events: [event] }))).status).toBe(401);
    expect(db.inserted).toEqual([]);
  });

  test("refuses cross-site requests that would ride on the user's cookies", async () => {
    expect((await ingest(post({ events: [event] }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await ingest(post({ events: [event] }, { origin: "https://evil.example" }))).status).toBe(403);
    expect(db.inserted).toEqual([]);
  });

  test("accepts same-origin browser requests", async () => {
    const res = await ingest(
      post({ events: [event] }, { "sec-fetch-site": "same-origin", origin: "http://localhost" })
    );

    expect(res.status).toBe(204);
    expect(db.inserted).toHaveLength(1);
  });

  test("rejects oversized bodies before parsing and rate-limited callers", async () => {
    expect((await ingest(post({ events: [event] }, { "content-length": "999999" }))).status).toBe(413);
    mockLimit.mockResolvedValue({ success: false });
    expect((await ingest(post({ events: [event] }))).status).toBe(429);
    expect(db.inserted).toEqual([]);
  });

  test.each([
    ["has not chosen yet", null, null],
    ["has turned metrics off", { enabled: false }, null],
    ["cannot be checked because the table is missing", null, { code: "PGRST205" }],
  ])("drops events, quietly, from an account that %s", async (_label, consent, error) => {
    db.consent = consent;
    db.consentError = error;

    const res = await ingest(post({ events: [event] }));

    expect(res.status).toBe(204);
    expect(db.inserted).toEqual([]);
  });

  test("a failed profile lookup drops events rather than erroring the app", async () => {
    mockProfile.mockResolvedValue({ data: null, error: new Error("down") });
    expect((await ingest(post({ events: [event] }))).status).toBe(204);
    expect(db.inserted).toEqual([]);
  });

  test("rejects anything outside the strict schema, storing nothing", async () => {
    for (const bad of [
      { events: [{ ...event, userId: "user_2abc" }] },
      { events: [{ ...event, path: `/chat/${THREAD_ID}` }] },
      { events: [{ ...event, route: `/chat/${THREAD_ID}` }] },
      { events: [{ ...event, ms: -5 }] },
      { events: [], extra: true },
      "not json",
    ]) {
      expect((await ingest(post(bad))).status).toBe(400);
    }
    expect(db.inserted).toEqual([]);
  });

  test("stores exactly the allowed columns, with the time bucketed to the hour by the server", async () => {
    const res = await ingest(post({ events: [event, { ...event, kind: "phase", ms: 61 }] }));

    expect(res.status).toBe(204);
    expect(db.inserted).toHaveLength(2);
    for (const row of db.inserted) {
      expect(Object.keys(row).sort()).toEqual(
        ["build", "conn", "device", "hour", "journey", "kind", "ms", "phase", "route", "trigger"].sort()
      );
      expect(JSON.stringify(row)).not.toContain("profile_1");
      expect(JSON.stringify(row)).not.toContain("clerk_test_user");

      const hour = new Date(String(row.hour));

      expect([hour.getUTCMinutes(), hour.getUTCSeconds(), hour.getUTCMilliseconds()]).toEqual([0, 0, 0]);
    }
  });
});

describe("/api/perf/consent", () => {
  test("GET reports only the caller's own state, and 401s when signed out", async () => {
    expect(await (await consentGet()).json()).toEqual({ state: "on" });

    clearPerfConsentCache();
    db.consent = null;
    expect(await (await consentGet()).json()).toEqual({ state: "unset" });

    mockAuth.mockResolvedValue({ userId: null });
    expect((await consentGet()).status).toBe(401);
  });

  test("an unreachable table reads as unavailable, so the client does not collect", async () => {
    db.consentError = { code: "42P01" };
    expect(await (await consentGet()).json()).toEqual({ state: "unavailable" });
  });

  test("PUT records the choice for the account and nothing else", async () => {
    const res = await consentPut(put({ enabled: false }));

    expect(await res.json()).toEqual({ state: "off" });
    expect(db.upserts).toHaveLength(1);
    expect(Object.keys(db.upserts[0]).sort()).toEqual(["enabled", "profile_id", "updated_at"]);
    expect(db.upserts[0]).toMatchObject({ profile_id: "profile_1", enabled: false });
  });

  test("a choice made on this instance takes effect on the very next batch", async () => {
    await consentPut(put({ enabled: false }));
    db.consent = { enabled: true }; // a stale row must not win over the cached fresh write

    await ingest(post({ events: [event] }));
    expect(db.inserted).toEqual([]);
  });

  test("PUT validates strictly and refuses cross-site callers", async () => {
    expect((await consentPut(put({ enabled: "yes" }))).status).toBe(400);
    expect((await consentPut(put({ enabled: true, userId: "x" }))).status).toBe(400);
    expect((await consentPut(put({ enabled: true }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(db.upserts).toEqual([]);
  });

  test("a failed write is reported as unavailable, never as success", async () => {
    db.upsertError = { code: "500" };
    expect(await (await consentPut(put({ enabled: true }))).json()).toEqual({ state: "unavailable" });
  });
});
