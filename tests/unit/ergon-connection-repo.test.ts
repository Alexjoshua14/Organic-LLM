import { describe, expect, test } from "bun:test";

import {
  createSupabaseErgonConnectionRepo,
  ErgonConnectionStoreError,
  type ErgonConnectionRow,
} from "@/lib/connectors/ergon-connection-repo";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECRET_CIPHERTEXT = "enc:v1:k1:c2VjcmV0:dGFn:Y2lwaGVy";

type Call = {
  table: string;
  op: string;
  payload?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

const row: ErgonConnectionRow = {
  owner_id: OWNER,
  url: "https://ergon.example.com",
  mcp_url: "https://ergon.example.com/mcp",
  scopes: ["read"],
  token_ciphertext: SECRET_CIPHERTEXT,
  refresh_token_ciphertext: null,
  expires_at: null,
  connected_at: "2026-11-05T00:00:00.000Z",
  last_ok_at: null,
  version: 1,
};

/**
 * Minimal chainable stand-in for the Supabase client. Fails any query on an owner-scoped
 * operation that did not filter by owner_id: a dropped owner filter is the bug that matters.
 */
function fakeClient(outcome: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const result = { data: outcome.data ?? null, error: outcome.error ?? null };

  const query = (table: string, op: string, payload?: Record<string, unknown>) => {
    const call: Call = { table, op, payload, filters: [] };
    const settle = () => {
      calls.push(call);
      const scoped = op !== "upsert";
      const ownerFiltered = call.filters.some(([col]) => col === "owner_id");

      if (scoped && !ownerFiltered) {
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
      single: () => settle(),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        settle().then(resolve, reject),
    };

    return builder;
  };

  const client = {
    from: (table: string) => ({
      select: () => query(table, "select"),
      upsert: (payload: Record<string, unknown>) => query(table, "upsert", payload),
      update: (payload: Record<string, unknown>) => query(table, "update", payload),
      delete: () => query(table, "delete"),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });

      return Promise.resolve(result);
    },
  };

  return { client: client as never, calls, rpcs };
}

describe("Supabase Ergon connection repository", () => {
  test("every read, update and delete is scoped to the owner", async () => {
    const { client, calls } = fakeClient({ data: row });
    const repo = createSupabaseErgonConnectionRepo(client);

    await repo.get(OWNER);
    await repo.rotate(OWNER, 3, {
      token_ciphertext: SECRET_CIPHERTEXT,
      refresh_token_ciphertext: null,
      expires_at: null,
      last_ok_at: null,
    });
    await repo.touchLastOk(OWNER, "2026-11-05T00:00:00.000Z");
    await repo.releaseRefreshLock(OWNER);
    await repo.remove(OWNER);

    expect(calls.map((call) => call.op)).toEqual(["select", "update", "update", "update", "delete"]);
    for (const call of calls) {
      expect(call.table).toBe("ergon_connections");
      expect(call.filters).toContainEqual(["owner_id", OWNER]);
    }
    expect(calls[1].filters).toContainEqual(["version", 3]);
  });

  test("upsert writes the owner from the argument and clears any lock", async () => {
    const { client, calls } = fakeClient({ data: row });
    const repo = createSupabaseErgonConnectionRepo(client);
    const { owner_id: _owner, version: _version, ...write } = row;

    await repo.upsert(OWNER, { ...write });

    expect(calls[0].payload).toMatchObject({ owner_id: OWNER, refresh_lock_until: null });
  });

  test("claims the refresh lock through the database function with the owner", async () => {
    const { client, rpcs } = fakeClient({ data: true });

    expect(await createSupabaseErgonConnectionRepo(client).claimRefreshLock(OWNER, 45)).toBe(true);
    expect(rpcs).toEqual([
      { fn: "claim_ergon_refresh_lock", args: { p_owner_id: OWNER, p_ttl_seconds: 45 } },
    ]);
  });

  test("rejects anything that is not a profile UUID before querying", async () => {
    const { client, calls } = fakeClient({ data: row });
    const repo = createSupabaseErgonConnectionRepo(client);

    for (const bad of ["", "user-a", "x' or '1'='1", `${OWNER},owner_id.neq.0`]) {
      await expect(repo.get(bad)).rejects.toThrow(ErgonConnectionStoreError);
      await expect(repo.remove(bad)).rejects.toThrow(ErgonConnectionStoreError);
    }
    expect(calls).toHaveLength(0);
  });

  test("database errors never leak row details such as ciphertext", async () => {
    const { client } = fakeClient({
      error: {
        code: "23514",
        message: "new row violates check constraint",
        details: `Failing row contains (${SECRET_CIPHERTEXT})`,
      },
    });
    const repo = createSupabaseErgonConnectionRepo(client);
    const failure = await repo.get(OWNER).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ErgonConnectionStoreError);
    expect((failure as ErgonConnectionStoreError).code).toBe("23514");
    expect(JSON.stringify(failure)).not.toContain("enc:");
    expect((failure as Error).message).not.toContain("enc:");
    expect((failure as Error).stack ?? "").not.toContain(SECRET_CIPHERTEXT);
  });

  test("a rotate that matched no row (lost compare-and-swap) returns null", async () => {
    const { client } = fakeClient({ data: null });
    const repo = createSupabaseErgonConnectionRepo(client);

    expect(
      await repo.rotate(OWNER, 1, {
        token_ciphertext: SECRET_CIPHERTEXT,
        refresh_token_ciphertext: null,
        expires_at: null,
        last_ok_at: null,
      })
    ).toBeNull();
  });
});
