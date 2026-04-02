"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";

import {
  createStrataPage,
  renameStrataPage,
  upsertStrataGeneratedSections,
  upsertStrataSection,
} from "@/data/supabase/strata";
import {
  type StrataGenerationContext,
  type StrataSection,
  type StrataSectionKey,
} from "@/lib/schemas/strata";

export async function createAndOpenStrataPageAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const page = await createStrataPage({ title: title || undefined });

  revalidateTag(`strata-pages:${page.owner_id}`, "max");
  revalidateTag(`strata-page:${page.id}`, "max");

  redirect(`/sandbox/prototypes/strata/${page.id}`);
}

export async function renameStrataPageAction(pageId: string, ownerId: string, title: string) {
  await renameStrataPage(pageId, title.trim() || "Untitled Strata page");
  revalidateTag(`strata-pages:${ownerId}`, "max");
  revalidateTag(`strata-page:${pageId}`, "max");
}

export async function saveStrataSectionAction(params: {
  pageId: string;
  ownerId: string;
  sectionKey: StrataSectionKey;
  content: string;
  contentJson?: Record<string, unknown> | null;
}) {
  await upsertStrataSection({
    pageId: params.pageId,
    sectionKey: params.sectionKey,
    content: params.content,
    contentJson: params.contentJson ?? null,
  });

  revalidateTag(`strata-pages:${params.ownerId}`, "max");
  revalidateTag(`strata-page:${params.pageId}`, "max");
}

export async function saveStrataGeneratedSectionsAction(params: {
  pageId: string;
  ownerId: string;
  existing: Record<StrataSectionKey, StrataSection>;
  refinedTitle: string;
  refinedText: string;
  elaborated: string;
  elaboratedArtifacts?: Record<string, unknown>;
  overwriteElaborated?: boolean;
  rawGenerationContext?: StrataGenerationContext;
}) {
  await upsertStrataGeneratedSections({
    pageId: params.pageId,
    existing: params.existing,
    refinedTitle: params.refinedTitle,
    refinedText: params.refinedText,
    elaborated: params.elaborated,
    elaboratedArtifacts: params.elaboratedArtifacts,
    overwriteElaborated: params.overwriteElaborated,
    rawGenerationContext: params.rawGenerationContext,
  });

  revalidateTag(`strata-pages:${params.ownerId}`, "max");
  revalidateTag(`strata-page:${params.pageId}`, "max");
}
