"use server";
import type { Json } from "@/lib/supabase/types";

import { auth } from "@clerk/nextjs/server";

import { supabaseServer } from "@/lib/supabase/server";
import { Result } from "@/types";
import { Profile, ProfileSchema } from "@/lib/schemas/profiles";
import {
  type ProfileTree,
  ProfileTreeSchema,
  type ProfileTreeSource,
  ProfileTreeSourceSchema,
} from "@/lib/schemas/profileTree";

export type PersistedProfileTree = {
  tree: ProfileTree | null;
  source: ProfileTreeSource | null;
  updatedAt: string | null;
};

const PROFILE_TREE_SELECT = "profile_tree, profile_tree_source, profile_tree_updated_at";

function errorResult<T>(message: string): Result<T> {
  return {
    data: null,
    error: new Error(message),
  };
}

async function getCurrentClerkUserId(): Promise<Result<string>> {
  const { userId } = await auth();

  if (!userId) return errorResult("Unauthorized");

  return { data: userId, error: null };
}

function parsePersistedProfileTree(row: {
  profile_tree: unknown;
  profile_tree_source: unknown;
  profile_tree_updated_at: unknown;
}): PersistedProfileTree {
  return {
    tree: row.profile_tree ? ProfileTreeSchema.parse(row.profile_tree) : null,
    source: row.profile_tree_source ? ProfileTreeSourceSchema.parse(row.profile_tree_source) : null,
    updatedAt: typeof row.profile_tree_updated_at === "string" ? row.profile_tree_updated_at : null,
  };
}

/**
 * Retrieves a profile from Supabase by Clerk user ID
 * @param clerkUserId
 * @returns
 */
export async function getProfile(clerkUserId: string): Promise<Result<Profile>> {
  const sb = await supabaseServer();
  const res = await sb.from("profiles").select("*").eq("clerk_user_id", clerkUserId).single();

  if (res.error) {
    return {
      data: null,
      error: new Error(res.error?.message ?? "Unknown error"),
    };
  }
  try {
    const profile = ProfileSchema.parse(res.data);

    return {
      data: profile,
      error: null,
    };
  } catch (error: any) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }
}

/**
 * Retrieves a user's supabase ID from Supabase by Clerk user ID
 * @param clerkUserId
 * @returns User's supabase ID
 */
export async function getSupabaseUserId(clerkUserId: string): Promise<Result<string>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  return {
    data: data.id,
    error: null,
  };
}

export async function getProfileTreeForCurrentUser(): Promise<Result<PersistedProfileTree>> {
  const currentUser = await getCurrentClerkUserId();

  if (currentUser.error || !currentUser.data) {
    return errorResult(currentUser.error?.message ?? "Unauthorized");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_TREE_SELECT)
    .eq("clerk_user_id", currentUser.data)
    .single();

  if (error) {
    return errorResult(error.message ?? "Failed to load profile tree");
  }

  try {
    return {
      data: parsePersistedProfileTree(data),
      error: null,
    };
  } catch (error: any) {
    return errorResult(error?.message ?? "Failed to parse profile tree");
  }
}

export async function upsertProfileTreeForCurrentUser(
  tree: ProfileTree,
  source: ProfileTreeSource
): Promise<Result<void>> {
  const currentUser = await getCurrentClerkUserId();

  if (currentUser.error || !currentUser.data) {
    return errorResult(currentUser.error?.message ?? "Unauthorized");
  }

  let validatedTree: ProfileTree;
  let validatedSource: ProfileTreeSource;

  try {
    validatedTree = ProfileTreeSchema.parse(tree);
    validatedSource = ProfileTreeSourceSchema.parse(source);
  } catch (error: any) {
    return errorResult(error?.message ?? "Invalid profile tree");
  }

  const sb = await supabaseServer();
  const { error } = await sb
    .from("profiles")
    .update({
      profile_tree: validatedTree as unknown as Json,
      profile_tree_source: validatedSource,
    })
    .eq("clerk_user_id", currentUser.data);

  if (error) {
    return errorResult(error.message ?? "Failed to save profile tree");
  }

  return { data: undefined, error: null };
}

export async function patchProfileTreeFieldsForCurrentUser({
  headline,
  signature,
}: {
  headline?: string;
  signature?: string;
}): Promise<Result<ProfileTree>> {
  const currentTree = await getProfileTreeForCurrentUser();

  if (currentTree.error) return errorResult(currentTree.error.message);
  if (!currentTree.data?.tree) return errorResult("Profile tree not found");

  const nextTree = ProfileTreeSchema.parse({
    ...currentTree.data.tree,
    headline: headline ?? currentTree.data.tree.headline,
    signature: signature ?? currentTree.data.tree.signature,
  });

  const saveResult = await upsertProfileTreeForCurrentUser(nextTree, "user-edited");

  if (saveResult.error) return errorResult(saveResult.error.message);

  return { data: nextTree, error: null };
}

/**
 * Whether the given user should see the sandbox gateway (admin-only entry).
 * Defaults to true until the profiles.admin column exists; once it exists, respects profile.admin.
 * Cached per user on the client — call from a server action for the current user.
 */
export async function getShowSandboxGateway(clerkUserId: string): Promise<boolean> {
  const result = await getProfile(clerkUserId);

  if (result.error || !result.data) return true;

  return result.data.admin !== false;
}

/**
 * Server action: whether the signed-in user should see the sandbox gateway.
 * Use from the client and cache the result per userId.
 */
export async function getShowSandboxGatewayForCurrentUser(): Promise<boolean> {
  const { userId } = await auth();

  if (!userId) return false;

  return getShowSandboxGateway(userId);
}
