import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

type Call = [method: string, ...args: unknown[]];

/** Records the query chain per `from()` call and resolves with the queued result. */
class RecordingClient {
  queries: Call[][] = [];
  results: Array<{ data: unknown; error: { message: string } | null }> = [];

  from(table: string) {
    const calls: Call[] = [["from", table]];
    const result = this.results.shift() ?? { data: [], error: null };

    this.queries.push(calls);

    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };

    for (const method of ["select", "eq", "not", "or", "filter", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);

        return builder;
      };
    }

    return builder;
  }
}

let client: RecordingClient;

mock.module("@/lib/supabase/server", () => ({
  supabaseServer: () => Promise.resolve(client),
}));

const { getSidebarThreadsPage } = await import("@/data/supabase/sidebar-threads");

const row = (id: string, updatedAt: string, pinned = false) => ({
  id,
  title: id,
  owner_id: "owner",
  created_at: updatedAt,
  updated_at: updatedAt,
  pinned,
  feature: "main",
  path: null,
});

describe("getSidebarThreadsPage", () => {
  beforeEach(() => {
    client = new RecordingClient();
  });

  test("first page: unpinned page and pinned list, both owner- and scope-filtered", async () => {
    client.results = [
      { data: [row("b", "2026-10-02T00:00:00Z"), row("a", "2026-10-01T00:00:00Z")], error: null },
      { data: [row("p", "2026-09-01T00:00:00Z", true)], error: null },
    ];

    const result = await getSidebarThreadsPage({ ownerId: "owner", scope: "main", cursor: null, limit: 1 });

    expect(result.error).toBeNull();
    expect(result.data?.data.map((r) => r.id)).toEqual(["b"]);
    expect(result.data?.pinned?.map((r) => r.id)).toEqual(["p"]);
    expect(result.data?.nextCursor).not.toBeNull();

    const [page, pinned] = client.queries;

    expect(page).toContainEqual(["eq", "owner_id", "owner"]);
    expect(page).toContainEqual(["not", "pinned", "is", true]);
    expect(page).toContainEqual(["filter", "feature", "eq", "main"]);
    expect(page).toContainEqual(["order", "updated_at", { ascending: false }]);
    expect(page).toContainEqual(["order", "id", { ascending: false }]);
    expect(page).toContainEqual(["limit", 2]);
    expect(pinned).toContainEqual(["eq", "owner_id", "owner"]);
    expect(pinned).toContainEqual(["eq", "pinned", true]);
    expect(pinned).toContainEqual(["filter", "feature", "eq", "main"]);
  });

  test("later pages apply the cursor and skip the pinned query", async () => {
    const cursor = { updatedAt: "2026-10-01T00:00:00.5+00:00", id: "a" };

    await getSidebarThreadsPage({ ownerId: "owner", scope: "all", cursor, limit: 50 });

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]).toContainEqual(["filter", "feature", "neq", "memory-ingest"]);
    expect(client.queries[0]).toContainEqual([
      "or",
      'updated_at.lt."2026-10-01T00:00:00.5+00:00",and(updated_at.eq."2026-10-01T00:00:00.5+00:00",id.lt.a)',
    ]);
  });

  test("returns an error when either query fails", async () => {
    client.results = [
      { data: [], error: null },
      { data: null, error: { message: "pinned failed" } },
    ];

    const result = await getSidebarThreadsPage({ ownerId: "owner", scope: "main", cursor: null, limit: 50 });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("pinned failed");
  });
});
