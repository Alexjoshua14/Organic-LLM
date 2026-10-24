import { supabaseServer } from "@/lib/supabase/server";

/**
 * Bytea wire format. The Supabase JS client serialises `Uint8Array` payloads to PostgREST as the
 * `\\x…` hex escape format and decodes inbound bytea columns into the same hex strings — this
 * helper normalises both directions so callers always work with raw `Uint8Array`s.
 */
const HEX_PREFIX = "\\x";

function bytesToHex(bytes: Uint8Array): string {
  let out = "";

  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }

  return `${HEX_PREFIX}${out}`;
}

function hexToBytes(value: string | null | undefined): Uint8Array {
  if (!value) return new Uint8Array(0);
  const stripped = value.startsWith(HEX_PREFIX) ? value.slice(HEX_PREFIX.length) : value;

  if (stripped.length === 0) return new Uint8Array(0);
  const out = new Uint8Array(stripped.length / 2);

  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(stripped.substr(i * 2, 2), 16);
  }

  return out;
}

export type StrataNoteSnapshotRow = {
  page_id: string;
  note_id: string;
  snapshot: Uint8Array;
  state_vector: Uint8Array;
  version: number;
  updated_at: string;
};

export type StrataNoteUpdateRow = {
  id: string;
  page_id: string;
  note_id: string;
  update: Uint8Array;
  client_id: string;
  created_at: string;
};

export async function getStrataNoteSnapshot(
  pageId: string,
  noteId: string
): Promise<StrataNoteSnapshotRow | null> {
  const sb = (await supabaseServer()) as any;
  const { data, error } = await sb
    .from("strata_note_snapshots")
    .select("page_id, note_id, snapshot, state_vector, version, updated_at")
    .eq("page_id", pageId)
    .eq("note_id", noteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    page_id: data.page_id,
    note_id: data.note_id,
    snapshot: hexToBytes(data.snapshot),
    state_vector: hexToBytes(data.state_vector),
    version: data.version,
    updated_at: data.updated_at,
  };
}

export async function listStrataNoteUpdates(
  pageId: string,
  noteId: string
): Promise<StrataNoteUpdateRow[]> {
  const sb = (await supabaseServer()) as any;
  const { data, error } = await sb
    .from("strata_note_updates")
    .select("id, page_id, note_id, update, client_id, created_at")
    .eq("page_id", pageId)
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as Array<{
      id: string;
      page_id: string;
      note_id: string;
      update: string;
      client_id: string;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    page_id: row.page_id,
    note_id: row.note_id,
    update: hexToBytes(row.update),
    client_id: row.client_id,
    created_at: row.created_at,
  }));
}

export async function appendStrataNoteUpdate(params: {
  pageId: string;
  noteId: string;
  update: Uint8Array;
  clientId: string;
}): Promise<{ id: string }> {
  const sb = (await supabaseServer()) as any;
  const { data, error } = await sb
    .from("strata_note_updates")
    .insert({
      page_id: params.pageId,
      note_id: params.noteId,
      update: bytesToHex(params.update),
      client_id: params.clientId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return { id: (data as { id: string }).id };
}

export async function upsertStrataNoteSnapshot(params: {
  pageId: string;
  noteId: string;
  snapshot: Uint8Array;
  stateVector: Uint8Array;
  version: number;
}): Promise<void> {
  const sb = (await supabaseServer()) as any;
  const { error } = await sb.from("strata_note_snapshots").upsert(
    {
      page_id: params.pageId,
      note_id: params.noteId,
      snapshot: bytesToHex(params.snapshot),
      state_vector: bytesToHex(params.stateVector),
      version: params.version,
    },
    { onConflict: "page_id,note_id" }
  );

  if (error) throw new Error(error.message);
}

export async function deleteStrataNoteUpdates(
  pageId: string,
  noteId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const sb = (await supabaseServer()) as any;
  const { error } = await sb
    .from("strata_note_updates")
    .delete()
    .eq("page_id", pageId)
    .eq("note_id", noteId)
    .in("id", ids);

  if (error) throw new Error(error.message);
}

export async function countStrataNoteUpdates(pageId: string, noteId: string): Promise<number> {
  const sb = (await supabaseServer()) as any;
  const { count, error } = await sb
    .from("strata_note_updates")
    .select("*", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq("note_id", noteId);

  if (error) throw new Error(error.message);

  return count ?? 0;
}
