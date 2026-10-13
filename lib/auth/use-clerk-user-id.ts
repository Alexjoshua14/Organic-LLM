"use client";

import { useAuth } from "@clerk/nextjs";

/**
 * The signed-in Clerk user id, or null when signed out. `isLoaded` is false until
 * clerk-js has resolved the session, so callers can tell "signed out" from "not known yet".
 *
 * A seam over `useAuth` so client caches can key on the user without every test
 * mocking all of `@clerk/nextjs`.
 */
export function useClerkUserId(): { isLoaded: boolean; userId: string | null } {
  const { isLoaded, userId } = useAuth();

  return { isLoaded, userId: userId ?? null };
}
