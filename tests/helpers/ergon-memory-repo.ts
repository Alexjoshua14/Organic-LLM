import type {
  ErgonConnectionRepo,
  ErgonConnectionRow,
} from "@/lib/connectors/ergon-connection-repo";

/**
 * In-memory stand-in for `public.ergon_connections` with the same semantics as the migration:
 * the version bumps only when a token changes, rotate is a compare-and-swap, and the refresh
 * lock is claimed against a clock. Rows are copied in and out so callers cannot mutate storage.
 */
export function createMemoryErgonRepo(clock: () => number = Date.now) {
  const rows = new Map<string, ErgonConnectionRow>();
  const locks = new Map<string, number>();
  const log: string[] = [];
  const copy = (row: ErgonConnectionRow): ErgonConnectionRow => ({
    ...row,
    scopes: [...row.scopes],
  });

  const repo: ErgonConnectionRepo & {
    rows: Map<string, ErgonConnectionRow>;
    log: string[];
    failNext: Set<string>;
  } = {
    rows,
    log,
    failNext: new Set(),

    async get(ownerId) {
      log.push(`get:${ownerId}`);
      const row = rows.get(ownerId);

      return row ? copy(row) : null;
    },

    async upsert(ownerId, row) {
      log.push(`upsert:${ownerId}`);
      if (repo.failNext.delete("upsert")) throw new Error("simulated upsert failure");
      const previous = rows.get(ownerId);
      const next: ErgonConnectionRow = {
        ...row,
        owner_id: ownerId,
        version:
          previous === undefined
            ? 1
            : previous.version +
              Number(
                previous.token_ciphertext !== row.token_ciphertext ||
                  previous.refresh_token_ciphertext !== row.refresh_token_ciphertext
              ),
      };

      rows.set(ownerId, next);
      locks.delete(ownerId);

      return copy(next);
    },

    async rotate(ownerId, expectedVersion, rotation) {
      log.push(`rotate:${ownerId}:${expectedVersion}`);
      if (repo.failNext.delete("rotate")) throw new Error("simulated rotate failure");
      const row = rows.get(ownerId);

      if (!row || row.version !== expectedVersion) return null;

      const next: ErgonConnectionRow = {
        ...row,
        ...rotation,
        version:
          row.version +
          Number(
            row.token_ciphertext !== rotation.token_ciphertext ||
              row.refresh_token_ciphertext !== rotation.refresh_token_ciphertext
          ),
      };

      rows.set(ownerId, next);
      locks.delete(ownerId);

      return copy(next);
    },

    async touchLastOk(ownerId, lastOkAt) {
      const row = rows.get(ownerId);

      if (row) rows.set(ownerId, { ...row, last_ok_at: lastOkAt });
    },

    async claimRefreshLock(ownerId, ttlSeconds) {
      log.push(`claim:${ownerId}`);
      if (!rows.has(ownerId)) return false;
      const until = locks.get(ownerId);

      if (until !== undefined && until > clock()) return false;
      locks.set(ownerId, clock() + ttlSeconds * 1000);

      return true;
    },

    async releaseRefreshLock(ownerId) {
      log.push(`release:${ownerId}`);
      locks.delete(ownerId);
    },

    async remove(ownerId) {
      log.push(`remove:${ownerId}`);
      if (repo.failNext.delete("remove")) throw new Error("simulated delete failure");
      rows.delete(ownerId);
      locks.delete(ownerId);
    },
  };

  return repo;
}
