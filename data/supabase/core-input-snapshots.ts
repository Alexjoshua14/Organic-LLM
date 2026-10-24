import "server-only";

import type { SnapshotRow } from "@/lib/core-input/snapshot-store";

import { SNAPSHOT_CACHE_CAPACITY } from "@/lib/core-input/snapshot-store";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const logger = createLogger("data/supabase/core-input-snapshots.ts");

const TABLE = "core_input_snapshots";

export type SnapshotTableResult<T> =
  | { status: "ok"; data: T }
  | { status: "missing" }
  | { status: "error" };

function isMissingRelation(message: string, code?: string): boolean {
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    (message.includes(TABLE) &&
      (message.includes("does not exist") || message.includes("Could not find")))
  );
}

function failure(where: string, error: { message: string; code?: string }) {
  if (isMissingRelation(error.message, error.code)) {
    return { status: "missing" } as const;
  }
  logger.warn(where, error.message);

  return { status: "error" } as const;
}

/** Newest first, capped at the client cache size. */
export async function listCoreInputSnapshots(
  ownerId: string
): Promise<SnapshotTableResult<SnapshotRow[]>> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("scope_key, bits, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(SNAPSHOT_CACHE_CAPACITY);

  if (error) return failure("listCoreInputSnapshots", error);

  return {
    status: "ok",
    data: (data ?? []).map((row) => ({
      scopeKey: row.scope_key as string,
      value: Number(row.bits),
      updatedAt: Date.parse(row.updated_at as string),
    })),
  };
}

/**
 * Last write wins by client timestamp: rows older than what the server already holds are
 * dropped, so a stale device cannot overwrite a newer choice made elsewhere. Afterwards the
 * owner's oldest rows past the cap are pruned.
 */
export async function upsertCoreInputSnapshots(
  ownerId: string,
  rows: readonly SnapshotRow[]
): Promise<SnapshotTableResult<{ accepted: SnapshotRow[] }>> {
  if (rows.length === 0) return { status: "ok", data: { accepted: [] } };

  const existing = await supabaseAdmin
    .from(TABLE)
    .select("scope_key, updated_at")
    .eq("owner_id", ownerId)
    .in(
      "scope_key",
      rows.map((row) => row.scopeKey)
    );

  if (existing.error) return failure("upsertCoreInputSnapshots:existing", existing.error);

  const serverUpdatedAt = new Map(
    (existing.data ?? []).map((row) => [row.scope_key as string, Date.parse(row.updated_at)])
  );
  const accepted = rows.filter((row) => (serverUpdatedAt.get(row.scopeKey) ?? -1) < row.updatedAt);

  if (accepted.length > 0) {
    const { error } = await supabaseAdmin.from(TABLE).upsert(
      accepted.map((row) => ({
        owner_id: ownerId,
        scope_key: row.scopeKey,
        bits: row.value,
        updated_at: new Date(row.updatedAt).toISOString(),
      })),
      { onConflict: "owner_id,scope_key" }
    );

    if (error) return failure("upsertCoreInputSnapshots:upsert", error);
    await pruneCoreInputSnapshots(ownerId);
  }

  // Rows the server already had newer copies of are settled too; the next pull brings them.
  return { status: "ok", data: { accepted: [...rows] } };
}

async function pruneCoreInputSnapshots(ownerId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("scope_key")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .range(SNAPSHOT_CACHE_CAPACITY, SNAPSHOT_CACHE_CAPACITY + 255);

  if (error || !data || data.length === 0) return;

  const { error: deleteError } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("owner_id", ownerId)
    .in(
      "scope_key",
      data.map((row) => row.scope_key as string)
    );

  if (deleteError) logger.warn("pruneCoreInputSnapshots", deleteError.message);
}
