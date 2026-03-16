"use server";

/**
 * Public memory server actions — zero client-supplied identity.
 *
 * The client never sends userId or memoryId (except memoryId for delete, which is
 * validated against ownership). Identity is always resolved server-side via
 * getCurrentUserMem0UserId() (Clerk auth + Supabase profile). Only these five
 * actions are callable from the client; low-level store functions are server-only.
 */

import { SearchMemoryOptions, SearchResult } from "mem0ai/oss";
import { auth } from "@clerk/nextjs/server";

import {
  searchMemories as storeSearchMemories,
  getAllMemories as storeGetAllMemories,
  deleteMemory as storeDeleteMemory,
  wipeMemory as storeWipeMemory,
} from "./store";

import { Result } from "@/types";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  checkMemorySearchLimit,
  checkMemoryListLimit,
  checkMemoryDeleteLimit,
  checkMemoryWipeLimit,
} from "@/lib/rate-limit/memory";

/**
 * Resolves the current request's user to the Mem0 user key (Supabase user id).
 * Use this in server-only entry points that operate on the "current user's" memories.
 */
async function getCurrentUserMem0UserId(): Promise<Result<string, string>> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { data: null, error: "Not signed in" };
  }
  const sbResult = await getSupabaseUserId(clerkUserId);

  if (sbResult.error || sbResult.data === null) {
    return { data: null, error: "User profile not found" };
  }

  return { data: sbResult.data, error: null };
}

/**
 * Server-only memory search for the current user. Uses Clerk auth and Supabase
 * profile to resolve the Mem0 user key before searching.
 */
export async function searchMemoriesServer(
  query: string,
  options?: SearchMemoryOptions
): Promise<Result<SearchResult, string>> {
  try {
    const userIdResult = await getCurrentUserMem0UserId();

    if (userIdResult.error || userIdResult.data === null) {
      return { data: null, error: userIdResult.error ?? "Not signed in" };
    }

    const limitResult = await checkMemorySearchLimit(userIdResult.data);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many requests" };
    }

    if (typeof query !== "string" || query.length > 2000) {
      return { data: null, error: "Invalid or too long query" };
    }

    const result = await storeSearchMemories(query, userIdResult.data, options);

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetches all persisted memories for the current user (for Memory Lens UI).
 * Uses Clerk auth + Supabase profile to resolve user id for Mem0.
 */
export async function getCurrentUserMemories(): Promise<Result<SearchResult, string>> {
  try {
    const userIdResult = await getCurrentUserMem0UserId();

    if (userIdResult.error || userIdResult.data === null) {
      return { data: null, error: userIdResult.error ?? "Not signed in" };
    }

    const limitResult = await checkMemoryListLimit(userIdResult.data);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many requests" };
    }

    const result = await storeGetAllMemories(userIdResult.data);

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetches up to N memories for the current user matching a semantic search query.
 * Uses Clerk auth + Supabase profile; useful for curated lens views (e.g. sandbox demo).
 */
export async function getCurrentUserMemoriesBySearch(
  query: string,
  limit: number = 5
): Promise<Result<SearchResult, string>> {
  try {
    const userIdResult = await getCurrentUserMem0UserId();

    if (userIdResult.error || userIdResult.data === null) {
      return { data: null, error: userIdResult.error ?? "Not signed in" };
    }

    const limitResult = await checkMemorySearchLimit(userIdResult.data);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many requests" };
    }

    if (typeof query !== "string" || query.length > 2000) {
      return { data: null, error: "Invalid or too long query" };
    }
    const clampedLimit = Math.min(100, Math.max(1, Number(limit) || 5));

    const result = await storeSearchMemories(query, userIdResult.data, {
      limit: clampedLimit,
    });

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Server-only delete for the current user. Verifies the memory belongs to the
 * current user (via scoped getAll) before calling Mem0 delete. Use this from
 * the UI instead of deleteMemory.
 */
export async function deleteMemoryForCurrentUser(
  memoryId: string
): Promise<Result<boolean, string>> {
  try {
    const userIdResult = await getCurrentUserMem0UserId();

    if (userIdResult.error || userIdResult.data === null) {
      return { data: null, error: userIdResult.error ?? "Not signed in" };
    }

    const limitResult = await checkMemoryDeleteLimit(userIdResult.data);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many requests" };
    }

    const trimmedId = typeof memoryId === "string" ? memoryId.trim() : "";

    if (!trimmedId || trimmedId.length > 256) {
      return { data: null, error: "Invalid memory ID" };
    }

    const owned = await storeGetAllMemories(userIdResult.data);
    const belongsToUser = owned.results?.some((m) => m.id === trimmedId);

    if (!belongsToUser) {
      return { data: null, error: "Memory not found" };
    }

    const ok = await storeDeleteMemory(trimmedId);

    return { data: ok, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Server-only wipe for the current user. Resolves the current user and wipes
 * all their memories. Use this from the UI for the "wipe memory" button.
 */
export async function wipeMemoryForCurrentUser(): Promise<Result<boolean, string>> {
  try {
    const userIdResult = await getCurrentUserMem0UserId();

    if (userIdResult.error || userIdResult.data === null) {
      return { data: null, error: userIdResult.error ?? "Not signed in" };
    }

    const limitResult = await checkMemoryWipeLimit(userIdResult.data);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many requests" };
    }

    const ok = await storeWipeMemory(userIdResult.data);

    return { data: ok, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
