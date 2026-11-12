import type { UserConnectorsRepo, UserConnectorsRow } from "@/lib/connectors/user-connectors-repo";

/**
 * In-memory stand-in for `public.user_connectors_profiles` with the migration's semantics: the
 * version bumps only when the payload changes, `insert` fails if the row exists, and `update` is
 * a compare-and-swap. Rows are copied in and out.
 */
export function createMemoryUserConnectorsRepo() {
  const rows = new Map<string, UserConnectorsRow>();
  const log: string[] = [];
  const failNext = new Set<"get" | "insert" | "update">();
  /** Runs once before the next `update`, to simulate a concurrent writer winning the race. */
  const beforeNextUpdate: Array<() => Promise<void> | void> = [];

  const repo: UserConnectorsRepo & {
    rows: Map<string, UserConnectorsRow>;
    log: string[];
    failNext: typeof failNext;
    beforeNextUpdate: typeof beforeNextUpdate;
  } = {
    rows,
    log,
    failNext,
    beforeNextUpdate,

    async get(ownerId) {
      log.push(`get:${ownerId}`);
      if (failNext.delete("get")) throw new Error("simulated read failure");
      const row = rows.get(ownerId);

      return row ? { ...row } : null;
    },

    async insert(ownerId, payloadCiphertext) {
      log.push(`insert:${ownerId}`);
      if (failNext.delete("insert")) throw new Error("simulated insert failure");
      if (rows.has(ownerId)) return null;
      const row = { payload_ciphertext: payloadCiphertext, version: 1 };

      rows.set(ownerId, row);

      return { ...row };
    },

    async update(ownerId, expectedVersion, payloadCiphertext) {
      log.push(`update:${ownerId}:${expectedVersion}`);
      await beforeNextUpdate.shift()?.();
      if (failNext.delete("update")) throw new Error("simulated update failure");
      const row = rows.get(ownerId);

      if (!row || row.version !== expectedVersion) return null;
      const next = {
        payload_ciphertext: payloadCiphertext,
        version: row.version + Number(row.payload_ciphertext !== payloadCiphertext),
      };

      rows.set(ownerId, next);

      return { ...next };
    },
  };

  return repo;
}
