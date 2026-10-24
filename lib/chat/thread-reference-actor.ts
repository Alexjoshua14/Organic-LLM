import "server-only";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseUserId } from "@/data/supabase/profiles";

export async function threadReferenceActor(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await getSupabaseUserId(userId);
  return profile.error ? null : profile.data;
}
