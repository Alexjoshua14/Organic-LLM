import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { mockModulePreservingReal } from "../helpers/module-mock";

import * as supabaseServerModule from "@/lib/supabase/server";

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

let results: Record<string, QueryResult> = {};
let rpcResult: QueryResult = { data: null, error: { message: "unset" } };
let rpcCalls = 0;

/** Any chain of filters on a table resolves to that table's canned result. */
function tableQuery(table: string) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;

  for (const method of ["select", "eq", "gt", "not"]) chain[method] = self;
  chain.then = (resolve: (value: QueryResult) => unknown) => resolve(results[table]);

  return chain;
}

const restoreSupabaseServer = mockModulePreservingReal(
  "@/lib/supabase/server",
  supabaseServerModule,
  {
    supabaseServer: async () =>
      ({
        from: tableQuery,
        rpc: async () => {
          rpcCalls += 1;

          return rpcResult;
        },
      }) as never,
  }
);

afterAll(restoreSupabaseServer);

const { getThreadAttention, resetThreadAttentionRpcState } = await import(
  "@/data/supabase/thread-attention?attention-test"
);

const missingFunction = {
  data: null,
  error: { code: "PGRST202", message: "Could not find the function sidebar_thread_attention" },
};

describe("getThreadAttention via sidebar_thread_attention", () => {
  beforeEach(() => {
    resetThreadAttentionRpcState();
    rpcCalls = 0;
  });

  test("one call returns every attention row", async () => {
    rpcResult = {
      data: [
        { thread_id: "t-new", unseen: true, working: false, generation_step: null },
        { thread_id: "t-hole", unseen: false, working: true, generation_step: "article" },
        { thread_id: "t-chat", unseen: true, working: true, generation_step: null },
      ],
      error: null,
    };

    const res = await getThreadAttention({ ownerId: "owner", staleAfterMs: 60_000 });

    expect(res.data).toEqual([
      { id: "t-new", unseen: true, working: null },
      { id: "t-hole", unseen: false, working: { step: "article" } },
      { id: "t-chat", unseen: true, working: { step: null } },
    ]);
    expect(rpcCalls).toBe(1);
  });

  test("falls back to table queries until the function exists, without retrying every poll", async () => {
    rpcResult = missingFunction as QueryResult;
    results = {
      thread_attention: { data: [], error: null },
      threads: { data: [{ id: "t-chat" }], error: null },
      rabbit_hole_sessions: { data: [], error: null },
    };

    const first = await getThreadAttention({ ownerId: "owner", staleAfterMs: 60_000 });
    const second = await getThreadAttention({ ownerId: "owner", staleAfterMs: 60_000 });

    expect(first.data).toEqual([{ id: "t-chat", unseen: false, working: { step: null } }]);
    expect(second.data).toEqual(first.data);
    expect(rpcCalls).toBe(1);
  });
});

describe("getThreadAttention via table queries (pre-migration)", () => {
  beforeEach(() => {
    rpcResult = missingFunction as QueryResult;
    results = {
      thread_attention: { data: [{ thread_id: "t-new" }], error: null },
      threads: { data: [{ id: "t-chat" }], error: null },
      rabbit_hole_sessions: {
        data: [{ chat_thread_id: "t-hole", generation_step: "article" }],
        error: null,
      },
    };
  });

  test("merges unseen, streaming, and generating threads", async () => {
    const res = await getThreadAttention({ ownerId: "owner", staleAfterMs: 60_000 });

    expect(res.error).toBeNull();
    expect(res.data).toEqual([
      { id: "t-new", unseen: true, working: null },
      { id: "t-chat", unseen: false, working: { step: null } },
      { id: "t-hole", unseen: false, working: { step: "article" } },
    ]);
  });

  test("still reports working threads when the attention table is missing", async () => {
    results.thread_attention = {
      data: null,
      error: { message: "Could not find the table 'public.thread_attention'" },
    };

    const res = await getThreadAttention({ ownerId: "owner", staleAfterMs: 60_000 });

    expect(res.error).toBeNull();
    expect(res.data?.map((row) => row.id)).toEqual(["t-chat", "t-hole"]);
  });

  test("errors only when every source fails", async () => {
    for (const table of Object.keys(results)) {
      results[table] = { data: null, error: { message: "down" } };
    }

    const res = await getThreadAttention({ ownerId: "owner", staleAfterMs: 60_000 });

    expect(res.data).toBeNull();
    expect(res.error).toBeInstanceOf(Error);
  });
});
