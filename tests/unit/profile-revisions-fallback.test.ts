import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as clerk from "@clerk/nextjs/server";
import * as supabaseServerModule from "@/lib/supabase/server";
import { mockModulePreservingReal } from "../helpers/module-mock";

import { createProfileTreeRevisionForCurrentUser } from "@/data/supabase/profiles";

const tree = { headline: "A headline", sections: [{ id: "about", title: "About", body: "Body" }] };
const missingTable = {
  code: "PGRST205",
  message: "Could not find the table 'public.profile_tree_revisions' in the schema cache",
};

type Written = { table: string; op: string; values?: unknown };
let writes: Written[] = [];
let revisionsError: { code: string; message: string } | null = missingTable;

/** A fake client: profiles reads resolve the id, profiles writes succeed, revisions fail as set. */
function fakeClient() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () =>
          table === "profiles" && !chain.writing ? chain : Promise.resolve({ error: null }),
        single: () =>
          Promise.resolve(
            table === "profiles"
              ? { data: { id: "sb_1" }, error: null }
              : { data: revisionsError ? null : { id: "rev_9" }, error: revisionsError }
          ),
        update(values: unknown) {
          writes.push({ table, op: "update", values });
          chain.writing = true;

          return table === "profile_tree_revisions"
            ? { eq: () => ({ eq: () => Promise.resolve({ error: revisionsError }) }) }
            : { eq: () => Promise.resolve({ error: null }) };
        },
        insert(values: unknown) {
          writes.push({ table, op: "insert", values });

          return chain;
        },
      };

      return chain;
    },
  };
}

const restores: Array<() => void> = [];

beforeAll(() => {
  restores.push(
    mockModulePreservingReal("@clerk/nextjs/server", clerk, {
      auth: (async () => ({ userId: "clerk_1" })) as unknown as typeof clerk.auth,
    }),
    mockModulePreservingReal("@/lib/supabase/server", supabaseServerModule, {
      supabaseServer: (async () =>
        fakeClient()) as unknown as typeof supabaseServerModule.supabaseServer,
    })
  );
});
afterAll(() => {
  for (const restore of restores) restore();
});

describe("profile revisions without the revision-history migration", () => {
  test("an active profile is still saved to the live profile", async () => {
    writes = [];
    revisionsError = missingTable;
    const result = await createProfileTreeRevisionForCurrentUser({
      tree,
      source: "llm-generated",
      status: "active",
      reviewScore: 0.9,
    });

    expect(result).toEqual({ data: { revisionId: null }, error: null });
    expect(writes.some((w) => w.table === "profiles" && w.op === "update")).toBe(true);
  });

  test("a draft is not written anywhere and still reports success", async () => {
    writes = [];
    const result = await createProfileTreeRevisionForCurrentUser({
      tree,
      source: "partial-generated",
      status: "draft",
    });

    expect(result).toEqual({ data: { revisionId: null }, error: null });
    expect(writes.some((w) => w.table === "profiles")).toBe(false);
  });

  test("other database errors are still reported", async () => {
    revisionsError = {
      code: "42501",
      message: "permission denied for table profile_tree_revisions",
    };
    const result = await createProfileTreeRevisionForCurrentUser({
      tree,
      source: "partial-generated",
      status: "draft",
    });

    expect(result.error?.message).toContain("permission denied");
  });
});
