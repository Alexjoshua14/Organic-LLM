import { supabaseServer } from "@/lib/supabase/server";
import {
  STRATA_DEFAULT_UNTITLED_TITLE,
  STRATA_SECTION_ORDER,
  type StrataGenerationContext,
  type StrataPage,
  type StrataPageWithSections,
  type StrataSection,
  type StrataSectionKey,
} from "@/lib/schemas/strata";
import {
  buildDefaultStrataSectionRows,
  buildGeneratedSectionUpserts,
} from "@/lib/strata/section-utils";
import {
  decryptStrataSectionContent,
  encryptStrataSectionContent,
} from "@/lib/strata/strata-section-encryption";

type StrataPageRow = {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

type StrataSectionRow = {
  id: string;
  page_id: string;
  section_key: StrataSectionKey;
  content: string;
  content_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapRowsToSectionRecord(
  rows: StrataSectionRow[],
  pageId: string,
  ownerId: string
): Record<StrataSectionKey, StrataSection> {
  const mapped = {} as Record<StrataSectionKey, StrataSection>;

  for (const key of STRATA_SECTION_ORDER) {
    const found = rows.find((r) => r.section_key === key);
    const raw = found?.content ?? "";
    const content = raw.length === 0 ? "" : decryptStrataSectionContent(raw, ownerId, pageId, key);

    mapped[key] = {
      key,
      content,
      contentJson: (found?.content_json as Record<string, unknown> | null | undefined) ?? null,
    };
  }

  return mapped;
}

export async function listStrataPages(options?: { ownerId?: string }): Promise<StrataPage[]> {
  const sb = (await supabaseServer()) as any;
  const baseQuery = sb
    .from("strata_pages")
    .select("id, title, owner_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  const { data, error } = options?.ownerId
    ? await baseQuery.eq("owner_id", options.ownerId)
    : await baseQuery;

  if (error) throw new Error(error.message);

  return ((data ?? []) as StrataPageRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    owner_id: row.owner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/** Avoid `unstable_cache` here — it runs without Clerk/Next request context (`auth()` / `cookies()`). */
export async function listStrataPagesCached(ownerId: string): Promise<StrataPage[]> {
  return listStrataPages({ ownerId });
}

/**
 * **Homepage / launcher routing contract:** recent Strata pages with a short decrypted excerpt
 * (refined_text preferred, else raw_text) for classifier parity with thread summaries.
 * Caps and sort are defined here; callers must not inflate the list beyond `maxPages`.
 */
export const MAX_STRATA_HOMEPAGE_ROUTING = 24;

export const STRATA_ROUTING_EXCERPT_CHARS = 400;

export type StrataRoutingRow = {
  id: string;
  title: string;
  updated_at: string;
  excerpt: string | null;
};

function excerptFromEncryptedSections(
  ownerId: string,
  pageId: string,
  sections: Partial<Record<"refined_text" | "raw_text", string>>
): string | null {
  const tryDecrypt = (raw: string, key: "refined_text" | "raw_text"): string | null => {
    if (!raw || raw.length === 0) return null;

    try {
      const decrypted = decryptStrataSectionContent(raw, ownerId, pageId, key).trim();

      if (!decrypted) return null;

      return decrypted.length > STRATA_ROUTING_EXCERPT_CHARS
        ? `${decrypted.slice(0, STRATA_ROUTING_EXCERPT_CHARS)}…`
        : decrypted;
    } catch {
      return null;
    }
  };

  const fromRefined = sections.refined_text
    ? tryDecrypt(sections.refined_text, "refined_text")
    : null;

  if (fromRefined) return fromRefined;

  return sections.raw_text ? tryDecrypt(sections.raw_text, "raw_text") : null;
}

export async function listStrataPagesWithRoutingExcerpts(
  ownerId: string,
  maxPages: number = MAX_STRATA_HOMEPAGE_ROUTING
): Promise<StrataRoutingRow[]> {
  const pages = await listStrataPages({ ownerId });
  const slice = pages.slice(0, maxPages);

  if (slice.length === 0) return [];

  const ids = slice.map((p) => p.id);
  const sb = (await supabaseServer()) as any;

  const { data: sectionRows, error } = await sb
    .from("strata_sections")
    .select("page_id, section_key, content")
    .in("page_id", ids)
    .in("section_key", ["refined_text", "raw_text"]);

  if (error) throw new Error(error.message);

  const byPage = new Map<string, Partial<Record<"refined_text" | "raw_text", string>>>();

  for (const row of (sectionRows ?? []) as {
    page_id: string;
    section_key: string;
    content: string;
  }[]) {
    if (row.section_key !== "refined_text" && row.section_key !== "raw_text") continue;

    const prev = byPage.get(row.page_id) ?? {};

    prev[row.section_key] = row.content;
    byPage.set(row.page_id, prev);
  }

  return slice.map((page) => ({
    id: page.id,
    title: page.title,
    updated_at: page.updated_at,
    excerpt: excerptFromEncryptedSections(ownerId, page.id, byPage.get(page.id) ?? {}),
  }));
}

export async function getStrataPageById(pageId: string): Promise<StrataPageWithSections | null> {
  const sb = (await supabaseServer()) as any;

  const { data: pageRow, error: pageError } = await sb
    .from("strata_pages")
    .select("id, title, owner_id, created_at, updated_at")
    .eq("id", pageId)
    .maybeSingle();

  if (pageError) throw new Error(pageError.message);
  if (!pageRow) return null;

  const { data: sectionRows, error: sectionError } = await sb
    .from("strata_sections")
    .select("id, page_id, section_key, content, content_json, created_at, updated_at")
    .eq("page_id", pageId);

  if (sectionError) throw new Error(sectionError.message);

  const page = pageRow as StrataPageRow;
  const rows = (sectionRows ?? []) as StrataSectionRow[];

  return {
    page: {
      id: page.id,
      title: page.title,
      owner_id: page.owner_id,
      created_at: page.created_at,
      updated_at: page.updated_at,
    },
    sections: mapRowsToSectionRecord(rows, page.id, page.owner_id),
  };
}

/** Avoid `unstable_cache` here — it runs without Clerk/Next request context (`auth()` / `cookies()`). */
export async function getStrataPageByIdCached(
  pageId: string
): Promise<StrataPageWithSections | null> {
  return getStrataPageById(pageId);
}

export async function createStrataPage(input?: { title?: string }): Promise<StrataPage> {
  const sb = (await supabaseServer()) as any;
  const title = input?.title?.trim() || STRATA_DEFAULT_UNTITLED_TITLE;

  const { data, error } = await sb
    .from("strata_pages")
    .insert({ title })
    .select("id, title, owner_id, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create Strata page");

  const defaultSections = buildDefaultStrataSectionRows((data as StrataPageRow).id);
  const { error: sectionsError } = await sb.from("strata_sections").insert(defaultSections);

  if (sectionsError) throw new Error(sectionsError.message);

  return data as StrataPage;
}

export async function renameStrataPage(pageId: string, title: string): Promise<void> {
  const sb = (await supabaseServer()) as any;
  const { error } = await sb.from("strata_pages").update({ title }).eq("id", pageId);

  if (error) throw new Error(error.message);
}

export async function upsertStrataSection(params: {
  pageId: string;
  ownerId: string;
  sectionKey: StrataSectionKey;
  content: string;
  contentJson?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = (await supabaseServer()) as any;
  const stored = encryptStrataSectionContent(
    params.content,
    params.ownerId,
    params.pageId,
    params.sectionKey
  );
  const { error } = await sb.from("strata_sections").upsert(
    {
      page_id: params.pageId,
      section_key: params.sectionKey,
      content: stored,
      content_json: params.contentJson ?? null,
    },
    { onConflict: "page_id,section_key" }
  );

  if (error) throw new Error(error.message);
}

export async function upsertStrataGeneratedSections(params: {
  pageId: string;
  ownerId: string;
  existing: Record<StrataSectionKey, StrataSection>;
  refinedTitle: string;
  refinedText: string;
  elaborated: string;
  elaboratedArtifacts?: Record<string, unknown>;
  overwriteElaborated?: boolean;
  rawGenerationContext?: StrataGenerationContext;
}): Promise<void> {
  const updates = buildGeneratedSectionUpserts({
    existing: params.existing,
    refinedTitle: params.refinedTitle,
    refinedText: params.refinedText,
    elaborated: params.elaborated,
    elaboratedArtifacts: params.elaboratedArtifacts,
    overwriteElaborated: params.overwriteElaborated,
  });

  for (const update of updates) {
    await upsertStrataSection({
      pageId: params.pageId,
      ownerId: params.ownerId,
      sectionKey: update.sectionKey,
      content: update.content,
      contentJson: update.contentJson ?? null,
    });
  }

  if (params.rawGenerationContext) {
    const rawContentJson = (params.existing.raw_text.contentJson ?? {}) as Record<string, unknown>;

    await upsertStrataSection({
      pageId: params.pageId,
      ownerId: params.ownerId,
      sectionKey: "raw_text",
      content: params.existing.raw_text.content,
      contentJson: {
        ...rawContentJson,
        generationContext: params.rawGenerationContext,
      },
    });
  }
}
