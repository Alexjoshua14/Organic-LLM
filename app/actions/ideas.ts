"use server";

import { revalidateTag } from "next/cache";
import { createIdea, updateIdea, deleteIdea } from "@/data/supabase/ideas";
import { IdeaStatus } from "@/lib/schemas/ideas";

export async function actionCreateIdea(formData: FormData) {
  const title = String(formData.get("title") || "");
  const notes = formData.get("notes")
    ? String(formData.get("notes"))
    : undefined;
  const summary = formData.get("summary")
    ? String(formData.get("summary"))
    : undefined;
  const priority = Number(formData.get("priority") || 2);
  const status = IdeaStatus.parse(String(formData.get("status") || "active"));

  const row = await createIdea({
    title,
    notes,
    summary,
    priority,
    status,
    tags: [],
  });
  revalidateTag("ideas"); // if you use fetch caching + tags
  return row;
}

export async function actionUpdateIdea(id: string, patch: any) {
  const row = await updateIdea(id, patch);
  revalidateTag("ideas");
  return row;
}

export async function actionDeleteIdea(id: string) {
  await deleteIdea(id);
  revalidateTag("ideas");
}
