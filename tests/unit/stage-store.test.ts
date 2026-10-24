import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type RedisValue = string | undefined;

const values = new Map<string, string>();
const lists = new Map<string, string[]>();
const hashes = new Map<string, Map<string, string>>();
const expiries = new Map<string, number>();
const realRedis = { ...(await import("@/lib/redis/redis")) };
const originalRootSecret = process.env.ORGANIC_LLM_ROOT_SECRET;
process.env.ORGANIC_LLM_ROOT_SECRET ??= "stage-store-test-root-secret";

const redisMock = {
  get: mock(async (key: string): Promise<RedisValue> => values.get(key)),
  set: mock(async (key: string, value: string, options?: { nx?: boolean; px?: number }) => {
    if (options?.nx && values.has(key)) return null;
    values.set(key, value);
    if (options?.px) expiries.set(key, options.px);
    return "OK";
  }),
  hexists: mock(async (key: string, field: string) => Number(hashes.get(key)?.has(field) ?? false)),
  eval: mock(async (script: string, keys: string[], args: string[]) => {
    if (script.includes("local current = redis.call('GET', KEYS[1])")) {
      const [headKey, eventsKey, requestsKey, leaseKey] = keys;
      const [expected, next, requestId, leaseToken, requestRevision] = args;
      if ((values.get(headKey) ?? "") !== expected) return 0;
      if (requestId && hashes.get(requestsKey)?.has(requestId)) return -1;
      if (leaseToken && values.get(leaseKey) !== leaseToken) return -2;
      values.set(headKey, next);
      const events = lists.get(eventsKey) ?? [];
      events.unshift(next);
      lists.set(eventsKey, events);
      if (requestId) {
        const requests = hashes.get(requestsKey) ?? new Map<string, string>();
        requests.set(requestId, requestRevision);
        hashes.set(requestsKey, requests);
      }
      return 1;
    }
    if (script.includes("local head = redis.call('GET', KEYS[1])")) {
      const [headKey, eventsKey] = keys;
      const [beforeArg, limitArg] = args;
      const latest = Number(values.get(headKey)?.match(/^(\d+)\|/)?.[1] ?? 0);
      if (!latest) return [];
      const before = Number(beforeArg);
      const target = before > 0 ? Math.min(latest, before - 1) : latest;
      const start = latest - target;
      return (lists.get(eventsKey) ?? []).slice(start, start + Number(limitArg));
    }
    if (script.includes("redis.call('GET', KEYS[1]) == ARGV[1]")) {
      if (values.get(keys[0]) === args[0]) {
        values.delete(keys[0]);
        return 1;
      }
      return 0;
    }
    throw new Error("Unexpected Redis script in stage store test");
  }),
};

afterAll(() => {
  if (originalRootSecret === undefined) delete process.env.ORGANIC_LLM_ROOT_SECRET;
  else process.env.ORGANIC_LLM_ROOT_SECRET = originalRootSecret;
});

afterEach(() => {
  // `mock.module` affects the whole Bun process. Restore the module captured before this suite
  // so later unit files continue to use the preload's Redis implementation.
  mock.module("@/lib/redis/redis", () => realRedis);
});

const OWNER = "owner-stage-test";
const REQUEST = "11111111-1111-4111-8111-111111111111";

function makeEvent(revision: number, requestId: string | null = null) {
  const at = new Date(Date.UTC(2026, 0, 1, 0, 0, revision)).toISOString();
  return {
    revision,
    at,
    cause: "turn" as const,
    requestId,
    lastModel: null,
    nextModel: "openai/gpt-6-luna",
    usage: null,
    call: null,
    bundle: {
      revision,
      updatedAt: at,
      widgets: [],
      messages: [],
      summary: `private snapshot ${revision}`,
      lastModel: null,
      nextModel: "openai/gpt-6-luna",
      design: null,
      pendingDesigns: [],
    },
  };
}

beforeEach(() => {
  mock.module("@/lib/redis/redis", () => ({ redis: redisMock }));
  values.clear();
  lists.clear();
  hashes.clear();
  expiries.clear();
  for (const operation of [redisMock.get, redisMock.set, redisMock.hexists, redisMock.eval]) {
    operation.mockClear();
  }
});

describe("stage event persistence", () => {
  test("stores encrypted snapshots and accepts only the matching head revision", async () => {
    const { appendStageEvent, readStage, listStageEvents } = await import("@/lib/stage/store");
    const initial = await readStage(OWNER);
    const event = makeEvent(1);

    expect(await appendStageEvent(OWNER, initial.raw, event)).toBe(true);
    const stored = await readStage(OWNER);
    expect(stored.state).toEqual(event.bundle);
    expect(stored.raw).not.toContain("private snapshot");
    expect(await appendStageEvent(OWNER, initial.raw, makeEvent(1))).toBe(false);
    expect((await listStageEvents(OWNER)).events).toEqual([event]);
  });

  test("fences stale lease tokens and releases only the owning token", async () => {
    const { acquireStageLease, appendStageEvent, readStage, releaseStageLease } = await import(
      "@/lib/stage/store"
    );
    const lease = await acquireStageLease(OWNER, "turn");
    expect(lease).not.toBeNull();
    const initial = await readStage(OWNER);

    await expect(
      appendStageEvent(OWNER, initial.raw, makeEvent(1), {
        lease: { scope: "turn", token: "expired-token" },
      })
    ).rejects.toThrow("Stage generation lease expired");
    expect((await readStage(OWNER)).state.revision).toBe(0);

    await releaseStageLease(OWNER, { scope: "turn", token: "expired-token" });
    expect(await appendStageEvent(OWNER, initial.raw, makeEvent(1), { lease: lease! })).toBe(true);
    await releaseStageLease(OWNER, lease!);
    expect(values.size).toBe(1); // The snapshot head remains after the lease is released.
  });

  test("records a request only after a successful CAS and deduplicates concurrent retries", async () => {
    const { appendStageEvent, hasStageRequest, mutateStage, readStage } = await import(
      "@/lib/stage/store"
    );
    const initial = await readStage(OWNER);
    const failed = await appendStageEvent(OWNER, "stale-head", makeEvent(1, REQUEST), {
      deduplicate: true,
    });
    expect(failed).toBe(false);
    expect(await hasStageRequest(OWNER, REQUEST)).toBe(false);

    await mutateStage(
      OWNER,
      "turn-failed",
      (state) => ({ ...state, summary: "retryable failure" }),
      {
        requestId: REQUEST,
        call: { operation: "turn", model: "openai/gpt-6-luna", outcome: "failed" },
      }
    );
    expect(await hasStageRequest(OWNER, REQUEST)).toBe(false);

    const mutate = (state: Awaited<ReturnType<typeof readStage>>["state"]) => ({
      ...state,
      summary: "completed request",
    });
    const results = await Promise.all([
      mutateStage(OWNER, "turn", mutate, { requestId: REQUEST, deduplicate: true }),
      mutateStage(OWNER, "turn", mutate, { requestId: REQUEST, deduplicate: true }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await hasStageRequest(OWNER, REQUEST)).toBe(true);
    expect((await readStage(OWNER)).state.revision).toBe(initial.state.revision + 2);
  });

  test("keeps a cursor page stable when a newer event is appended", async () => {
    const { appendStageEvent, listStageEvents, readStage } = await import("@/lib/stage/store");
    let raw = (await readStage(OWNER)).raw;
    for (let revision = 1; revision <= 3; revision++) {
      expect(await appendStageEvent(OWNER, raw, makeEvent(revision))).toBe(true);
      raw = (await readStage(OWNER)).raw;
    }

    const firstPage = await listStageEvents(OWNER, undefined, 2);
    expect(firstPage.events.map(({ revision }) => revision)).toEqual([3, 2]);
    expect(firstPage.nextCursor).toBe(2);

    expect(await appendStageEvent(OWNER, raw, makeEvent(4))).toBe(true);
    const olderPage = await listStageEvents(OWNER, firstPage.nextCursor!, 2);
    expect(olderPage.events.map(({ revision }) => revision)).toEqual([1]);
  });
});
