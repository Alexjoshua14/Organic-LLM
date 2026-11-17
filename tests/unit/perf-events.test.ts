import { describe, expect, test } from "bun:test";

import {
  PERF_DISCLOSURE,
  PERF_MAX_EVENTS_PER_BATCH,
  PERF_ROUTES,
  PERF_TRIGGERS,
  PerfBatchSchema,
  PerfEventSchema,
  perfRouteTemplate,
  perfTriggerKind,
} from "@/lib/perf/events";

const THREAD_ID = "3f2b8c1e-9d4a-4e7b-8a61-0c5d2e9f7a13";

const valid = {
  kind: "journey",
  journey: "to-chat",
  phase: "chat:ready",
  route: "/chat/[id]",
  trigger: "sidebar-thread",
  device: "desktop",
  conn: "4g",
  build: "0.12.3",
  ms: 184,
} as const;

describe("PerfEventSchema: nothing outside the allow-list can be stored", () => {
  test("accepts a well-formed event", () => {
    expect(PerfEventSchema.safeParse(valid).success).toBe(true);
  });

  test.each([
    ["an account id", { userId: "user_2abc" }],
    ["a thread id", { threadId: THREAD_ID }],
    ["a path", { path: `/chat/${THREAD_ID}` }],
    ["a session id", { sessionId: "abc" }],
    ["an ip address", { ip: "203.0.113.9" }],
    ["a user agent", { userAgent: "Mozilla/5.0" }],
    ["a client timestamp", { at: 1_700_000_000_000 }],
    ["a detail object", { detail: { threadId: THREAD_ID } }],
  ])("rejects an extra field carrying %s", (_label, extra) => {
    expect(PerfEventSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
  });

  test("rejects identifiers smuggled into the allowed string fields", () => {
    for (const patch of [
      { phase: THREAD_ID },
      { phase: `chat:ready/${THREAD_ID}` },
      { route: `/chat/${THREAD_ID}` },
      { trigger: `link:/chat/${THREAD_ID}` },
      { build: THREAD_ID },
      { build: "1.2.3-abcdef0" },
      { build: "v1.2.3" },
      { journey: "to-chat; drop table" },
      { device: "iPhone 15 Pro" },
      { conn: "wifi-home-5g" },
    ]) {
      expect(PerfEventSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
  });

  test("rejects out-of-range or non-integer timings", () => {
    for (const ms of [-1, 1.5, 120_001, Number.NaN, Number.POSITIVE_INFINITY, "184"]) {
      expect(PerfEventSchema.safeParse({ ...valid, ms }).success).toBe(false);
    }
  });

  test("a batch is bounded and strict", () => {
    const many = Array.from({ length: PERF_MAX_EVENTS_PER_BATCH + 1 }, () => valid);

    expect(PerfBatchSchema.safeParse({ events: many }).success).toBe(false);
    expect(PerfBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(PerfBatchSchema.safeParse({ events: [valid], userId: "user_2abc" }).success).toBe(false);
    expect(PerfBatchSchema.safeParse({ events: [valid] }).success).toBe(true);
  });
});

describe("the disclosure matches the schema", () => {
  test("the notice lists exactly the stored fields, plus the server-set hour", () => {
    const disclosed = PERF_DISCLOSURE.map((entry) => entry.field).sort();
    const stored = [...Object.keys(PerfEventSchema.shape), "hour"].sort();

    expect(disclosed).toEqual(stored);
  });
});

describe("perfRouteTemplate", () => {
  test("turns an id-bearing path into a template and never echoes the id", () => {
    for (const path of [
      `/chat/${THREAD_ID}`,
      `/chat/${THREAD_ID}/`,
      `/chat/${THREAD_ID}?draft=my%20private%20note`,
      `/chat/${THREAD_ID}#frag`,
    ]) {
      const route = perfRouteTemplate(path);

      expect(route).toBe("/chat/[id]");
      expect(route).not.toContain(THREAD_ID);
    }
    expect(perfRouteTemplate(`/sandbox/arcadia/${THREAD_ID}`)).toBe("/arcadia/[id]");
  });

  test("always returns a member of the closed list", () => {
    for (const path of [
      "/",
      "/settings",
      "/rabbitholes/browse",
      "/remy/abc",
      "/sandbox/prototypes/strata/abc",
      "/totally/unknown/path",
      "",
      "///",
    ]) {
      expect(PERF_ROUTES).toContain(perfRouteTemplate(path));
    }
    expect(perfRouteTemplate("/totally/unknown/path")).toBe("other");
  });
});

describe("perfTriggerKind", () => {
  test("drops the path out of document and link triggers", () => {
    expect(perfTriggerKind(`document:/chat/${THREAD_ID}`)).toBe("document");
    expect(perfTriggerKind(`link:/sandbox/arcadia/${THREAD_ID}`)).toBe("link");
  });

  test("maps known triggers and sends anything else to other", () => {
    expect(perfTriggerKind("sidebar-thread")).toBe("sidebar-thread");
    expect(perfTriggerKind("lets-chat")).toBe("lets-chat");
    expect(perfTriggerKind(`whatever-${THREAD_ID}`)).toBe("other");
    for (const raw of ["document:/", "link:x", "rail-chat", "nope", ""]) {
      expect(PERF_TRIGGERS).toContain(perfTriggerKind(raw));
    }
  });
});
