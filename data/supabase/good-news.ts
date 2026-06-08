import "server-only";

import { GoodNewsDigest, GoodNewsDigestSchema } from "@/lib/schemas/good-news";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const logger = createLogger("data/supabase/good-news.ts");

const TABLE = "good_news_digests";

type DigestRow = {
  digest_date: string;
  items: unknown;
  status: string | null;
  model: string | null;
  meta: unknown;
  generated_at: string;
};

function rowToDigest(row: DigestRow): GoodNewsDigest | null {
  const parsed = GoodNewsDigestSchema.safeParse({
    date: row.digest_date,
    items: row.items ?? [],
    generatedAt: row.generated_at,
    model: row.model ?? "unknown",
    meta: (row.meta as Record<string, unknown> | null) ?? undefined,
  });

  if (!parsed.success) {
    logger.error(
      "rowToDigest",
      `Invalid digest row for ${row.digest_date}: ${parsed.error.message}`
    );

    return null;
  }

  return parsed.data;
}

/** Read the digest for a specific ISO date (YYYY-MM-DD), or null if none. */
export async function getDigestForDate(date: string): Promise<GoodNewsDigest | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("digest_date, items, status, model, meta, generated_at")
    .eq("digest_date", date)
    .maybeSingle();

  if (error) {
    logger.error("getDigestForDate", `${date}: ${error.message}`);

    return null;
  }

  return data ? rowToDigest(data as DigestRow) : null;
}

/** Read the most recently generated digest, regardless of date. */
export async function getLatestDigest(): Promise<GoodNewsDigest | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("digest_date, items, status, model, meta, generated_at")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("getLatestDigest", error.message);

    return null;
  }

  return data ? rowToDigest(data as DigestRow) : null;
}

/** Upsert (insert or replace) the digest for its date. */
export async function upsertDigest(digest: GoodNewsDigest): Promise<{ error: Error | null }> {
  const { error } = await supabaseAdmin.from(TABLE).upsert(
    {
      digest_date: digest.date,
      items: digest.items,
      status: "ready",
      model: digest.model,
      meta: digest.meta ?? {},
      generated_at: digest.generatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "digest_date" }
  );

  if (error) {
    logger.error("upsertDigest", `${digest.date}: ${error.message}`);

    return { error: new Error(error.message) };
  }

  return { error: null };
}
