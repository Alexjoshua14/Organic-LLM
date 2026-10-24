import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as clerk from "@clerk/nextjs/server";
import * as profiles from "@/data/supabase/profiles";
import * as supabase from "@/lib/supabase/server";
import * as admin from "@/lib/supabase/supabase-admin";

import { hasSubagentThreadRows } from "@/data/supabase/subagent-threads";
import { mockModulePreservingReal } from "../helpers/module-mock";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let userId: string | null;
let profileExists: boolean;
let dbError: { message: string } | null;
let inserted: Record<string, unknown>;
let rows: Array<{ id: string; parent_thread_id: string; owner_id: string }>;
let restore: Array<() => void>;
const insert = mock((value: Record<string, unknown>) => {
  inserted = value;

  return { select: () => ({ single: async () => ({ data: { id: value.id }, error: dbError }) }) };
});
const from = mock((_table: string) => {
  const filters: Record<string, string> = {};
  const query = {
    insert,
    select: (_columns: string) => query,
    eq: (column: string, value: string) => {
      filters[column] = value;
      return query;
    },
    limit: async (count: number) => ({
      data: rows
        .filter((row) =>
          Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value)
        )
        .slice(0, count),
      error: dbError,
    }),
  };

  return query;
});

beforeEach(() => {
  userId = "user_test";
  profileExists = true;
  dbError = null;
  rows = [];
  insert.mockClear();
  from.mockClear();
  restore = [
    mockModulePreservingReal("@clerk/nextjs/server", clerk, {
      auth: (async () => ({ userId })) as never,
    }),
    mockModulePreservingReal("@/data/supabase/profiles", profiles, {
      getSupabaseUserId: async () => ({ data: profileExists ? OWNER : null, error: null }),
    }),
    mockModulePreservingReal("@/lib/supabase/server", supabase, {
      supabaseServer: (async () => ({ from })) as never,
    }),
    mockModulePreservingReal("@/lib/supabase/supabase-admin", admin, {
      supabaseAdmin: { from } as never,
    }),
  ];
});

afterEach(() => {
  for (const reset of restore.reverse()) reset();
});

describe("Arcadia initial thread persistence", () => {
  test("creation inserts the authenticated owner and canonical routing together", async () => {
    const result = await globalThis.__realChat.createChat(THREAD, "arcadia");

    expect(result).toEqual({ data: THREAD, error: null });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(inserted).toEqual({
      id: THREAD,
      owner_id: OWNER,
      feature: "arcadia",
      path: `/sandbox/arcadia/${THREAD}`,
    });
  });

  test("unauthenticated and missing-profile creation cannot write a thread", async () => {
    userId = null;
    expect((await globalThis.__realChat.createChat(THREAD, "arcadia")).data).toBeNull();
    userId = "user_test";
    profileExists = false;
    expect((await globalThis.__realChat.createChat(THREAD, "arcadia")).data).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  test("invalid runtime experiences and failed inserts never report successful creation", async () => {
    expect((await globalThis.__realChat.createChat(THREAD, "forged" as never)).data).toBeNull();
    expect(insert).not.toHaveBeenCalled();
    dbError = { message: "Insert failed" };
    expect((await globalThis.__realChat.createChat(THREAD, "arcadia")).data).toBeNull();
  });

  test("worker presence excludes other owners and other parents", async () => {
    rows = [
      { id: "foreign-worker", parent_thread_id: THREAD, owner_id: "another-owner" },
      { id: "another-thread-worker", parent_thread_id: "another-parent", owner_id: OWNER },
    ];
    expect(await hasSubagentThreadRows(THREAD, OWNER)).toBe(false);
    rows.push({ id: "owned-worker", parent_thread_id: THREAD, owner_id: OWNER });
    expect(await hasSubagentThreadRows(THREAD, OWNER)).toBe(true);
  });

  test("a failed presence read stays unknown so clients can still discover workers", async () => {
    dbError = { message: "Query unavailable" };
    expect(await hasSubagentThreadRows(THREAD, OWNER)).toBeNull();
  });
});
