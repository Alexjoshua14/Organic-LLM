import "server-only";

import type { supabaseAdmin } from "@/lib/supabase/supabase-admin";

import { isProfileUuid, safeDbCode } from "@/lib/connectors/repo-utils";

/**
 * Persistence for `public.user_connectors_profiles`
 * (docs/migrations/user_connectors_profiles.sql).
 *
 * Server-only, service-role only (RLS on, no policies). Every query is scoped by `owner_id`,
 * which is always an Organic profile id resolved from the authenticated session. Errors carry a
 * fixed message and a short code only; PostgREST `details` can contain the failing row.
 */

const TABLE = "user_connectors_profiles";
/** Only what a read needs. Keeping the select narrow keeps the hot-path payload minimal. */
const ROW_COLUMNS = "payload_ciphertext,version";

export type UserConnectorsRow = {
  payload_ciphertext: string;
  version: number;
};

export type UserConnectorsRepo = {
  get(ownerId: string): Promise<UserConnectorsRow | null>;
  /** Creates the row. Returns null when one already exists (a concurrent first save won). */
  insert(ownerId: string, payloadCiphertext: string): Promise<UserConnectorsRow | null>;
  /** Compare-and-swap on `version`. Returns null when another writer got there first. */
  update(
    ownerId: string,
    expectedVersion: number,
    payloadCiphertext: string
  ): Promise<UserConnectorsRow | null>;
};

export class UserConnectorsStoreError extends Error {
  readonly operation: string;
  readonly code: string | null;

  constructor(operation: string, code: string | null = null) {
    super(`User connectors store ${operation} failed`);
    this.name = "UserConnectorsStoreError";
    this.operation = operation;
    this.code = code;
  }
}

function requireOwnerId(ownerId: string): string {
  const id = ownerId.trim();

  if (!isProfileUuid(id)) throw new UserConnectorsStoreError("invalid_owner");

  return id;
}

type AdminClient = Pick<typeof supabaseAdmin, "from">;

export function createSupabaseUserConnectorsRepo(client: AdminClient): UserConnectorsRepo {
  return {
    async get(ownerId) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client
        .from(TABLE)
        .select(ROW_COLUMNS)
        .eq("owner_id", owner)
        .maybeSingle();

      if (error) throw new UserConnectorsStoreError("load", safeDbCode(error));

      return (data as UserConnectorsRow | null) ?? null;
    },

    async insert(ownerId, payloadCiphertext) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client
        .from(TABLE)
        .upsert(
          { owner_id: owner, payload_ciphertext: payloadCiphertext },
          { onConflict: "owner_id", ignoreDuplicates: true }
        )
        .select(ROW_COLUMNS)
        .maybeSingle();

      if (error) throw new UserConnectorsStoreError("save", safeDbCode(error));

      return (data as UserConnectorsRow | null) ?? null;
    },

    async update(ownerId, expectedVersion, payloadCiphertext) {
      const owner = requireOwnerId(ownerId);
      const { data, error } = await client
        .from(TABLE)
        .update({ payload_ciphertext: payloadCiphertext })
        .eq("owner_id", owner)
        .eq("version", expectedVersion)
        .select(ROW_COLUMNS)
        .maybeSingle();

      if (error) throw new UserConnectorsStoreError("save", safeDbCode(error));

      return (data as UserConnectorsRow | null) ?? null;
    },
  };
}

let defaultRepo: UserConnectorsRepo | null = null;

/** Lazily binds the admin client so importing the store never requires Supabase env. */
export async function getDefaultUserConnectorsRepo(): Promise<UserConnectorsRepo> {
  if (!defaultRepo) {
    const { supabaseAdmin: admin } = await import("@/lib/supabase/supabase-admin");

    defaultRepo = createSupabaseUserConnectorsRepo(admin);
  }

  return defaultRepo;
}

/** Test seam: route the default repository to an in-memory fake. Pass null to restore. */
export function setUserConnectorsRepoForTests(repo: UserConnectorsRepo | null): void {
  defaultRepo = repo;
}
