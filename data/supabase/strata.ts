"use server";

import { unstable_cache } from "next/cache";

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

function mapRowsToSectionRecord(rows: StrataSectionRow[]): Record<StrataSectionKey, StrataSection> {
  const mapped = {} as Record<StrataSectionKey, StrataSection>;

  for (const key of STRATA_SECTION_ORDER) {
    const found = rows.find((r) => r.section_key === key);
    mapped[key] = {
      key,
      content: found?.content ?? "",
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

export async function listStrataPagesCached(ownerId: string): Promise<StrataPage[]> {
  const load = unstable_cache(
    async () => listStrataPages({ ownerId }),
    ["strata-pages", ownerId],
    {
      tags: [`strata-pages:${ownerId}`],
      revalidate: 120,
    }
  );

  return load();
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
    sections: mapRowsToSectionRecord(rows),
  };
}

export async function getStrataPageByIdCached(pageId: string): Promise<StrataPageWithSections | null> {
  const load = unstable_cache(
    async () => getStrataPageById(pageId),
    ["strata-page", pageId],
    {
      tags: [`strata-page:${pageId}`],
      revalidate: 120,
    }
  );

  return load();
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
  sectionKey: StrataSectionKey;
  content: string;
  contentJson?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = (await supabaseServer()) as any;
  const { error } = await sb.from("strata_sections").upsert(
    {
      page_id: params.pageId,
      section_key: params.sectionKey,
      content: params.content,
      content_json: params.contentJson ?? null,
    },
    { onConflict: "page_id,section_key" }
  );
  if (error) throw new Error(error.message);
}

export async function upsertStrataGeneratedSections(params: {
  pageId: string;
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
      sectionKey: update.sectionKey,
      content: update.content,
      contentJson: update.contentJson ?? null,
    });
  }

  if (params.rawGenerationContext) {
    const rawContentJson = (params.existing.raw_text.contentJson ?? {}) as Record<string, unknown>;
    await upsertStrataSection({
      pageId: params.pageId,
      sectionKey: "raw_text",
      content: params.existing.raw_text.content,
      contentJson: {
        ...rawContentJson,
        generationContext: params.rawGenerationContext,
      },
    });
  }
}
