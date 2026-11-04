import { describe, expect, mock, test } from "bun:test";

import { acquireChatStreamLease, acquireSubagentStreamLease } from "@/lib/chat/stream-admission";

type Client = NonNullable<Parameters<typeof acquireChatStreamLease>[2]>;

/** Fake admin client: records the RPC args and the release delete's filters. */
function fakeClient(rpc: { data: unknown; error: unknown }, deleteError: unknown = null) {
  const rpcCalls: Array<{ fn: string; args: Record<string, string> }> = [];
  const deletes: Array<{ table: string; filters: Array<[string, string]> }> = [];
  const client = {
    rpc: mock(async (fn: string, args: Record<string, string>) => {
      rpcCalls.push({ fn, args });

      return rpc;
    }),
    from: (table: string) => ({
      delete: () => {
        const entry = { table, filters: [] as Array<[string, string]> };

        deletes.push(entry);
        const chain = {
          eq(column: string, value: string) {
            entry.filters.push([column, value]);

            return chain;
          },
          then(resolve: (value: { error: unknown }) => void) {
            resolve({ error: deleteError });
          },
        };

        return chain;
      },
    }),
  };

  return { client: client as unknown as Client, rpcCalls, deletes };
}

describe("acquireChatStreamLease", () => {
  test("acquired lease releases only its own token", async () => {
    const { client, rpcCalls, deletes } = fakeClient({ data: "acquired", error: null });
    const lease = await acquireChatStreamLease("owner", "thread", client);

    expect(lease.ok).toBe(true);
    expect(rpcCalls[0]?.fn).toBe("acquire_chat_stream_lease");
    const token = rpcCalls[0]!.args.p_token;

    expect(rpcCalls[0]?.args).toMatchObject({ p_owner_id: "owner", p_thread_id: "thread" });
    if (!lease.ok) throw new Error("expected lease");
    await lease.release();
    expect(deletes).toEqual([
      {
        table: "chat_stream_leases",
        filters: [
          ["owner_id", "owner"],
          ["thread_id", "thread"],
          ["token", token],
        ],
      },
    ]);
  });

  test("a subagent lease names its orchestrator and releases only its own token", async () => {
    const { client, rpcCalls, deletes } = fakeClient({ data: "acquired", error: null });
    const lease = await acquireSubagentStreamLease("owner", "parent", "worker", client);

    expect(rpcCalls[0]?.fn).toBe("acquire_subagent_stream_lease");
    expect(rpcCalls[0]?.args).toMatchObject({
      p_owner_id: "owner",
      p_parent_thread_id: "parent",
      p_thread_id: "worker",
    });
    if (!lease.ok) throw new Error("expected lease");
    await lease.release();
    expect(deletes[0]?.filters).toEqual([
      ["owner_id", "owner"],
      ["thread_id", "worker"],
      ["token", rpcCalls[0]!.args.p_token],
    ]);
  });

  test("a subagent capacity denial is a denial", async () => {
    const { client } = fakeClient({ data: "capacity", error: null });

    expect(await acquireSubagentStreamLease("owner", "parent", "worker", client)).toEqual({
      ok: false,
      reason: "capacity",
    });
  });

  test("each acquisition uses a fresh token", async () => {
    const { client, rpcCalls } = fakeClient({ data: "acquired", error: null });

    await acquireChatStreamLease("owner", "thread", client);
    await acquireChatStreamLease("owner", "thread", client);
    expect(rpcCalls[0]!.args.p_token).not.toBe(rpcCalls[1]!.args.p_token);
  });

  test.each(["busy", "capacity", "not_found"] as const)(
    "%s is a denial, not an error",
    async (reason) => {
      const { client } = fakeClient({ data: reason, error: null });

      expect(await acquireChatStreamLease("owner", "thread", client)).toEqual({
        ok: false,
        reason,
      });
    }
  );

  test("RPC errors and unknown results throw instead of admitting", async () => {
    const failed = fakeClient({ data: null, error: { message: "connection refused" } });

    await expect(acquireChatStreamLease("owner", "thread", failed.client)).rejects.toThrow(
      "Stream admission unavailable"
    );
    const unknown = fakeClient({ data: "maybe", error: null });

    await expect(acquireChatStreamLease("owner", "thread", unknown.client)).rejects.toThrow(
      "Unexpected stream admission result"
    );
  });

  test("a failed release is swallowed; expiry recovers the lease", async () => {
    const { client } = fakeClient({ data: "acquired", error: null }, { message: "timeout" });
    const lease = await acquireChatStreamLease("owner", "thread", client);

    if (!lease.ok) throw new Error("expected lease");
    await expect(lease.release()).resolves.toBeUndefined();
  });
});
