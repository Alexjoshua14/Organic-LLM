import { supabaseServer } from "@/lib/supabase/server";
import type { SpatialArtifactRow } from "@/lib/schemas/spatial-artifact";
import { GenUIBlockSchema } from "@/lib/schemas/gen-ui";

export type UpsertSpatialArtifactInput = {
  id: string;
  owner_id: string;
  thread_id: string;
  message_id: string;
  tool_call_id: string;
  block_type: string;
  thread_title: string;
  block_snapshot: unknown;
  snapshot_updated_at: string;
  source_message_updated_at: string;
  pinned: boolean;
  pinned_at: string | null;
};

export async function listSpatialArtifactRows(ownerId: string): Promise<SpatialArtifactRow[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("spatial_artifacts")
    .select("*")
    .eq("owner_id", ownerId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];

    throw new Error(error.message);
  }

  return (data ?? []) as SpatialArtifactRow[];
}

export async function getSpatialArtifactRow(id: string): Promise<SpatialArtifactRow | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("spatial_artifacts").select("*").eq("id", id).maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;

    throw new Error(error.message);
  }

  return (data as SpatialArtifactRow | null) ?? null;
}

export async function upsertSpatialArtifactRow(input: UpsertSpatialArtifactInput): Promise<void> {
  const sb = await supabaseServer();
  const block = GenUIBlockSchema.safeParse(input.block_snapshot);

  const { error } = await sb.from("spatial_artifacts").upsert(
    {
      ...input,
      block_snapshot: block.success ? block.data : input.block_snapshot,
      sync_lock_until: null,
    },
    { onConflict: "id" }
  );

  if (error) {
    if (error.code === "42P01") return;

    throw new Error(error.message);
  }
}

export async function setSpatialArtifactPinned(params: {
  id: string;
  ownerId: string;
  pinned: boolean;
}): Promise<void> {
  const sb = await supabaseServer();
  const { error } = await sb
    .from("spatial_artifacts")
    .update({
      pinned: params.pinned,
      pinned_at: params.pinned ? new Date().toISOString() : null,
    })
    .eq("id", params.id)
    .eq("owner_id", params.ownerId);

  if (error && error.code !== "42P01") {
    throw new Error(error.message);
  }
}

export async function listStaleSpatialArtifactRows(limit = 50): Promise<SpatialArtifactRow[]> {
  const sb = await supabaseServer();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("spatial_artifacts")
    .select("*")
    .or(`snapshot_updated_at.is.null,snapshot_updated_at.lt.${cutoff}`)
    .order("snapshot_updated_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    if (error.code === "42P01") return [];

    throw new Error(error.message);
  }

  return (data ?? []) as SpatialArtifactRow[];
}
