import "server-only";

import {
  ReleaseNotesCachePayload,
  ReleaseNotesCachePayloadSchema,
} from "@/lib/schemas/release-notes";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { releaseNotesCacheKey } from "@/lib/release-notes/cache-key";

const logger = createLogger("data/supabase/release-notes-cache.ts");

export const RELEASE_NOTES_CACHE_TABLE = "release_notes_cache";

type CacheRow = {
  from_sha: string;
  to_sha: string;
  from_version: string | null;
  to_version: string | null;
  commit_count: number;
  notes: unknown;
  model: string;
  generated_at: string;
};

function rowToPayload(row: CacheRow): ReleaseNotesCachePayload | null {
  const parsed = ReleaseNotesCachePayloadSchema.safeParse({
    fromSha: row.from_sha,
    toSha: row.to_sha,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    commitCount: row.commit_count,
    notes: row.notes,
    model: row.model,
    generatedAt: row.generated_at,
  });

  if (!parsed.success) {
    logger.error(
      "rowToPayload",
      `Invalid cache row ${row.from_sha}..${row.to_sha}: ${parsed.error.message}`
    );

    return null;
  }

  return parsed.data;
}

export async function getCachedReleaseNotes(args: {
  fromSha: string;
  toSha: string;
}): Promise<ReleaseNotesCachePayload | null> {
  const { data, error } = await supabaseAdmin
    .from(RELEASE_NOTES_CACHE_TABLE)
    .select(
      "from_sha, to_sha, from_version, to_version, commit_count, notes, model, generated_at"
    )
    .eq("from_sha", args.fromSha)
    .eq("to_sha", args.toSha)
    .maybeSingle();

  if (error) {
    logger.error(
      "getCachedReleaseNotes",
      `${releaseNotesCacheKey(args)}: ${error.message}`
    );

    return null;
  }

  return data ? rowToPayload(data as CacheRow) : null;
}

export async function upsertCachedReleaseNotes(
  payload: ReleaseNotesCachePayload
): Promise<{ error: Error | null }> {
  const { error } = await supabaseAdmin.from(RELEASE_NOTES_CACHE_TABLE).upsert(
    {
      from_sha: payload.fromSha,
      to_sha: payload.toSha,
      from_version: payload.fromVersion,
      to_version: payload.toVersion,
      commit_count: payload.commitCount,
      notes: payload.notes,
      model: payload.model,
      generated_at: payload.generatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "from_sha,to_sha" }
  );

  if (error) {
    logger.error(
      "upsertCachedReleaseNotes",
      `${releaseNotesCacheKey({ fromSha: payload.fromSha, toSha: payload.toSha })}: ${error.message}`
    );

    return { error: new Error(error.message) };
  }

  return { error: null };
}
