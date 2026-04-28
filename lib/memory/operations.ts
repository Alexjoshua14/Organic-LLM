"use server";

/**
 * Memory operations — single public server API for memory.
 *
 * Contract:
 * - Operations: only public server API; identity from auth or pre-resolved userId;
 *   all rate limits applied here; no client-supplied identity (except memoryId for
 *   delete, validated against ownership). Results are validated with lib/schemas/memory.
 * - Store: server-only; no auth; no rate limits; only operations (and tests) should
 *   call store. See lib/memory/README.md for full contract.
 */

import type { UIMessage } from "ai";

import { SearchMemoryOptions, SearchResult } from "mem0ai/oss";
import { auth } from "@clerk/nextjs/server";

import {
  searchMemories as storeSearchMemories,
  getAllMemories as storeGetAllMemories,
  deleteMemory as storeDeleteMemory,
  wipeMemory as storeWipeMemory,
  addLatestMessagesToMemory as storeAddLatestMessagesToMemory,
} from "./store";

import { SearchResult as SearchResultSchema, type SearchResultType } from "@/lib/schemas/memory";
import { Result } from "@/types";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  checkMemorySearchLimit,
  checkMemoryListLimit,
  checkMemoryDeleteLimit,
  checkMemoryWipeLimit,
  checkMemoryAddLimit,
} from "@/lib/rate-limit/memory";

/**
 * Resolves the current request's user to the Mem0 user key (Supabase user id).
 * Use this in server-only entry points that operate on the "current user's" memories.
 */
/**
 * Validates store output against the app memory schema. On failure returns
 * a generic error so malformed data does not cross the boundary.
 */
function validateSearchResult(result: SearchResult): Result<SearchResultType, string> {
  const parsed = SearchResultSchema.safeParse(result);

  if (!parsed.success) {
    return { data: null, error: "Invalid memory response" };
  }

  return { data: parsed.data, error: null };
}

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
 * Server-internal memory search for a pre-resolved user id. Applies rate limit
 * and query validation. Use from chat-store, llm-tool-kit, or other server
 * code that has already resolved userId (e.g. via getSupabaseUserId). Callers
 * must not pass client-supplied userId.
 *
 * @remarks Hits Upstash (rate limit) then Mem0 (network). For cached reads prefer
 * `searchMemoriesWithL1Cache` in `@/lib/memory/memory-search-cache`.
 */
export async function searchMemoriesForUser(
  userId: string,
  query: string,
  options?: SearchMemoryOptions
): Promise<Result<SearchResultType, string>> {
  try {
    if (!userId) {
      return { data: null, error: "User ID is required" };
    }

    const limitResult = await checkMemorySearchLimit(userId);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many requests" };
    }

    if (typeof query !== "string" || query.length > 2000) {
      return { data: null, error: "Invalid or too long query" };
    }

    const result = await storeSearchMemories(query, userId, options);

    return validateSearchResult(result);
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Server-internal add messages to memory for a pre-resolved user id. Applies
 * rate limit. Use from chat route, Aion handler, or other server code that
 * has already resolved userId. Callers must not pass client-supplied userId.
 */
export async function addLatestMessagesToMemoryForUser(
  userId: string,
  messages: UIMessage[],
  chatId?: string
): Promise<Result<SearchResultType, string>> {
  try {
    if (!userId) {
      return { data: null, error: "User ID is required" };
    }

    const limitResult = await checkMemoryAddLimit(userId);

    if (!limitResult.success) {
      return { data: null, error: limitResult.error ?? "Too many memory add requests" };
    }

    const result = await storeAddLatestMessagesToMemory(messages, userId, chatId);

    return validateSearchResult(result);
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Server-only memory search for the current user. Uses Clerk auth and Supabase
 * profile to resolve the Mem0 user key before searching.
 */
export async function searchMemoriesServer(
  query: string,
  options?: SearchMemoryOptions
): Promise<Result<SearchResultType, string>> {
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

    return validateSearchResult(result);
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
export async function getCurrentUserMemories(): Promise<Result<SearchResultType, string>> {
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

    return validateSearchResult(result);
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
/**
 * Full memory list for a server-resolved Supabase user id (Mem0 key).
 * For API routes that already authenticated the user; skips memory list rate limit
 * (caller should apply its own limits, e.g. LLM message limit).
 */
export async function getMemoriesOwnershipSnapshotForUser(
  supabaseUserId: string
): Promise<Result<SearchResultType, string>> {
  try {
    if (!supabaseUserId) {
      return { data: null, error: "User ID is required" };
    }

    const result = await storeGetAllMemories(supabaseUserId);

    return validateSearchResult(result);
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCurrentUserMemoriesBySearch(
  query: string,
  limit: number = 5
): Promise<Result<SearchResultType, string>> {
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

    return validateSearchResult(result);
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
