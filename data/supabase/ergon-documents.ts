"use server";

import type { ErgonDocument } from "@/lib/schemas/ergon-documents";

import { supabaseServer } from "@/lib/supabase/server";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto/message-encryption";
import { ErgonDocumentSchema } from "@/lib/schemas/ergon-documents";

function contentContext(ownerId: string, threadId: string) {
  return {
    userId: ownerId,
    threadId,
    fieldName: "ergon_documents.content" as const,
  };
}

function mapRow(row: Record<string, unknown>, ownerId: string): ErgonDocument {
  const threadId = String(row.thread_id);
  const decrypted = decryptFromStorage(String(row.content), contentContext(ownerId, threadId));

  return ErgonDocumentSchema.parse({
    ...row,
    content: decrypted,
  });
}

export type CreateErgonDocumentInput = {
  threadId: string;
  kanbanItemId: string;
  title: string;
  content: string;
};

export type UpdateErgonDocumentInput = {
  title?: string;
  content: string;
};

export async function createErgonDocument(
  input: CreateErgonDocumentInput
): Promise<ErgonDocument> {
  const supabase = await supabaseServer();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Profile not found");
  }

  const ownerId = profile.id as string;
  const encryptedContent = encryptForStorage(
    input.content,
    contentContext(ownerId, input.threadId)
  );

  const { data, error } = await supabase
    .from("ergon_documents")
    .insert({
      owner_id: ownerId,
      thread_id: input.threadId,
      kanban_item_id: input.kanbanItemId,
      title: input.title,
      content: encryptedContent,
      format: "markdown",
      version: 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return mapRow(data as Record<string, unknown>, ownerId);
}

export async function updateErgonDocument(
  id: string,
  patch: UpdateErgonDocumentInput
): Promise<ErgonDocument> {
  const supabase = await supabaseServer();
  const { data: existing, error: fetchError } = await supabase
    .from("ergon_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message ?? "Document not found");
  }

  const ownerId = String(existing.owner_id);
  const threadId = String(existing.thread_id);
  const encryptedContent = encryptForStorage(patch.content, contentContext(ownerId, threadId));
  const nextVersion = Number(existing.version) + 1;

  const { data, error } = await supabase
    .from("ergon_documents")
    .update({
      title: patch.title ?? existing.title,
      content: encryptedContent,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return mapRow(data as Record<string, unknown>, ownerId);
}

export async function getErgonDocument(id: string): Promise<ErgonDocument | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("ergon_documents").select("*").eq("id", id).maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;

    throw new Error(error.message);
  }

  if (!data) return null;

  return mapRow(data as Record<string, unknown>, String(data.owner_id));
}

export async function listErgonDocumentsForThread(threadId: string): Promise<ErgonDocument[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("ergon_documents")
    .select("*")
    .eq("thread_id", threadId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];

    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>, String(row.owner_id)));
}
