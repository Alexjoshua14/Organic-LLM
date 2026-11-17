import "server-only";

import type { supabaseAdmin } from "@/lib/supabase/supabase-admin";

import { isProfileUuid, safeDbCode } from "@/lib/connectors/repo-utils";

/**
 * Persistence for `public.ergon_connections` (docs/migrations/ergon_connections.sql).
 *
 * Server-only. The table is service-role only (RLS on, no policies), so every query here runs
 * through the admin client and MUST be scoped by `owner_id`. `owner_id` always comes from the
 * authenticated session in the calling route, never from a request body.
 *
 * Errors carry only a fixed message and a short Postgres/PostgREST code. PostgREST puts the
 * failing row (ciphertext included) in `details`, so supabase errors are never logged or
 * rethrown wholesale.
 */

const TABLE = "ergon_connections";
const ROW_COLUMNS =
  "owner_id,url,mcp_url,scopes,token_ciphertext,refresh_token_ciphertext,expires_at,connected_at,last_ok_at,version";

export type ErgonConnectionRow = {
  owner_id: string;
  url: string;
  mcp_url: string;
  scopes: string[];
  token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  expires_at: string | null;
  connected_at: string;
  last_ok_at: string | null;
  version: number;
};

/** Everything a connect writes. A reconnect replaces tokens and clears any refresh lock. */
export type ErgonConnectionUpsert = Omit<ErgonConnectionRow, "owner_id" | "version">;

/** What a token refresh writes; applies only if the row is still at `expectedVersion`. */
export type ErgonTokenRotation = {
  token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  expires_at: string | null;
  last_ok_at: string | null;
};

export type ErgonConnectionRepo = {
  get(ownerId: string): Promise<ErgonConnectionRow | null>;
  upsert(ownerId: string, row: ErgonConnectionUpsert): Promise<ErgonConnectionRow>;
  /** Compare-and-swap on `version`. Returns null when another writer got there first. */
  rotate(
    ownerId: string,
    expectedVersion: number,
    rotation: ErgonTokenRotation
  ): Promise<ErgonConnectionRow | null>;
  touchLastOk(ownerId: string, lastOkAt: string): Promise<void>;
  /** True when this caller now holds the refresh lock (database clock, TTL in seconds). */
  claimRefreshLock(ownerId: string, ttlSeconds: number): Promise<boolean>;
  releaseRefreshLock(ownerId: string): Promise<void>;
  remove(ownerId: string): Promise<void>;
};

export class ErgonConnectionStoreError extends Error {
  readonly operation: string;
  readonly code: string | null;

  constructor(operation: string, code: string | null = null) {
    super(`Ergon connection store ${operation} failed`);
    this.name = "ErgonConnectionStoreError";
    this.operation = operation;
    this.code = code;
  }
}

function requireOwnerId(ownerId: string): string {
  const id = ownerId.trim();

  if (!isProfileUuid(id)) throw new ErgonConnectionStoreError("invalid_owner");

  return id;
}

type AdminClient = Pick<typeof supabaseAdmin, "from" | "rpc">;

export function createSupabaseErgonConnectionRepo(client: AdminClient): ErgonConnectionRepo {
  return {
    async get(ownerId) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client
        .from(TABLE)
        .select(ROW_COLUMNS)
        .eq("owner_id", owner)
        .maybeSingle();

      if (error) throw new ErgonConnectionStoreError("load", safeDbCode(error));

      return (data as ErgonConnectionRow | null) ?? null;
    },

    async upsert(ownerId, row) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client
        .from(TABLE)
        .upsert({ ...row, owner_id: owner, refresh_lock_until: null }, { onConflict: "owner_id" })
        .select(ROW_COLUMNS)
        .single();

      if (error || !data) throw new ErgonConnectionStoreError("save", safeDbCode(error));

      return data as ErgonConnectionRow;
    },

    async rotate(ownerId, expectedVersion, rotation) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client
        .from(TABLE)
        .update({ ...rotation, refresh_lock_until: null })
        .eq("owner_id", owner)
        .eq("version", expectedVersion)
        .select(ROW_COLUMNS)
        .maybeSingle();

      if (error) throw new ErgonConnectionStoreError("rotate", safeDbCode(error));

      return (data as ErgonConnectionRow | null) ?? null;
    },

    async touchLastOk(ownerId, lastOkAt) {
      const owner = requireOwnerId(ownerId);
      const { error } = await client
        .from(TABLE)
        .update({ last_ok_at: lastOkAt })
        .eq("owner_id", owner);

      if (error) throw new ErgonConnectionStoreError("touch", safeDbCode(error));
    },

    async claimRefreshLock(ownerId, ttlSeconds) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client.rpc("claim_ergon_refresh_lock", {
        p_owner_id: owner,
        p_ttl_seconds: ttlSeconds,
      });

      if (error) throw new ErgonConnectionStoreError("claim_lock", safeDbCode(error));

      return data === true;
    },

    async releaseRefreshLock(ownerId) {
      const owner = requireOwnerId(ownerId);
      const { error } = await client
        .from(TABLE)
        .update({ refresh_lock_until: null })
        .eq("owner_id", owner);

      if (error) throw new ErgonConnectionStoreError("release_lock", safeDbCode(error));
    },

    async remove(ownerId) {
      const owner = requireOwnerId(ownerId);
      const { error } = await client.from(TABLE).delete().eq("owner_id", owner);

      if (error) throw new ErgonConnectionStoreError("delete", safeDbCode(error));
    },
  };
}

let defaultRepo: ErgonConnectionRepo | null = null;

/** Test seam: route the default repository to an in-memory fake. Pass null to restore. */
export function setErgonConnectionRepoForTests(repo: ErgonConnectionRepo | null): void {
  defaultRepo = repo;
}

/** Lazily binds the admin client so importing the store never requires Supabase env. */
export async function getDefaultErgonConnectionRepo(): Promise<ErgonConnectionRepo> {
  if (!defaultRepo) {
    const { supabaseAdmin: admin } = await import("@/lib/supabase/supabase-admin");

    defaultRepo = createSupabaseErgonConnectionRepo(admin);
  }

  return defaultRepo;
}
