import { describe, expect, test } from "bun:test";

import {
  createSupabaseUserConnectorsRepo,
  UserConnectorsStoreError,
} from "@/lib/connectors/user-connectors-repo";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CIPHERTEXT = "enc:v1:k1:c2VjcmV0:dGFn:Y2lwaGVy";

type Call = {
  table: string;
  op: string;
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
  columns?: string;
  filters: Array<[string, unknown]>;
};

/**
 * Minimal chainable stand-in for the Supabase client. Fails any owner-scoped read or update that
 * did not filter by owner_id: a dropped owner filter is the bug that matters most.
 */
function fakeClient(outcome: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  const result = { data: outcome.data ?? null, error: outcome.error ?? null };

  const query = (
    table: string,
    op: string,
    payload?: Record<string, unknown>,
    options?: Record<string, unknown>,
    columns?: string
  ) => {
    const call: Call = { table, op, payload, options, columns, filters: [] };
    const settle = () => {
      calls.push(call);

      if (op !== "upsert" && !call.filters.some(([column]) => column === "owner_id")) {
        return Promise.reject(new Error(`${op} ran without an owner_id filter`));
      }

      return Promise.resolve(result);
    };
    const builder: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        call.filters.push([column, value]);

        return builder;
      },
      select: () => builder,
      maybeSingle: () => settle(),
    };

    return builder;
  };

  const client = {
    from: (table: string) => ({
      select: (columns: string) => query(table, "select", undefined, undefined, columns),
      upsert: (payload: Record<string, unknown>, options: Record<string, unknown>) =>
        query(table, "upsert", payload, options),
      update: (payload: Record<string, unknown>) => query(table, "update", payload),
    }),
  };

  return { client: client as never, calls };
}

describe("Supabase user connectors repository", () => {
  test("reads select only the ciphertext and version, scoped to the owner", async () => {
    const { client, calls } = fakeClient({ data: { payload_ciphertext: CIPHERTEXT, version: 2 } });

    expect(await createSupabaseUserConnectorsRepo(client).get(OWNER)).toEqual({
      payload_ciphertext: CIPHERTEXT,
      version: 2,
    });
    expect(calls[0]).toMatchObject({
      table: "user_connectors_profiles",
      columns: "payload_ciphertext,version",
    });
    expect(calls[0].filters).toContainEqual(["owner_id", OWNER]);
  });

  test("updates compare-and-swap on the version and scope to the owner", async () => {
    const { client, calls } = fakeClient({ data: null });
    const repo = createSupabaseUserConnectorsRepo(client);

    expect(await repo.update(OWNER, 4, CIPHERTEXT)).toBeNull();
    expect(calls[0].filters).toContainEqual(["owner_id", OWNER]);
    expect(calls[0].filters).toContainEqual(["version", 4]);
  });

  test("insert never overwrites an existing row", async () => {
    const { client, calls } = fakeClient({ data: null });

    expect(await createSupabaseUserConnectorsRepo(client).insert(OWNER, CIPHERTEXT)).toBeNull();
    expect(calls[0].options).toMatchObject({ onConflict: "owner_id", ignoreDuplicates: true });
    expect(calls[0].payload).toEqual({ owner_id: OWNER, payload_ciphertext: CIPHERTEXT });
  });

  test("rejects anything that is not a profile UUID before querying", async () => {
    const { client, calls } = fakeClient({ data: null });
    const repo = createSupabaseUserConnectorsRepo(client);

    for (const bad of ["", "user_2abc", "x' or '1'='1", `${OWNER},owner_id.neq.0`]) {
      await expect(repo.get(bad)).rejects.toThrow(UserConnectorsStoreError);
      await expect(repo.update(bad, 1, CIPHERTEXT)).rejects.toThrow(UserConnectorsStoreError);
      await expect(repo.insert(bad, CIPHERTEXT)).rejects.toThrow(UserConnectorsStoreError);
    }
    expect(calls).toHaveLength(0);
  });

  test("database errors never leak row details such as ciphertext", async () => {
    const { client } = fakeClient({
      error: {
        code: "23514",
        message: "new row violates check constraint",
        details: `Failing row contains (${CIPHERTEXT})`,
      },
    });
    const failure = await createSupabaseUserConnectorsRepo(client)
      .update(OWNER, 1, CIPHERTEXT)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UserConnectorsStoreError);
    expect((failure as UserConnectorsStoreError).code).toBe("23514");
    expect((failure as Error).message).not.toContain("enc:");
    expect((failure as Error).stack ?? "").not.toContain(CIPHERTEXT);
  });
});
