import type { Result } from "@/types";

/** No profile row exists for the Clerk user, as opposed to a failed lookup. */
export class ProfileNotFoundError extends Error {
  constructor() {
    super("User profile not found");
    this.name = "ProfileNotFoundError";
  }
}

/**
 * Maps the `profiles` id lookup (`maybeSingle`) to a result. Zero rows is `ProfileNotFoundError`;
 * a query failure is a plain `Error`, so callers can tell a missing account from an unavailable
 * database. Kept free of imports so tests reach it without module mocks.
 */
export function profileIdResult(row: {
  data: { id: string } | null;
  error: { message?: string } | null;
}): Result<string> {
  if (row.error) return { data: null, error: new Error(row.error.message ?? "Unknown error") };
  if (!row.data) return { data: null, error: new ProfileNotFoundError() };

  return { data: row.data.id, error: null };
}
