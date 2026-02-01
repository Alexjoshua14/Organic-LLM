export type ClerkAuthResult = { userId: string } | null;

/**
 * Minimal Clerk `auth()` mock.
 * Your route checks for `{ userId }`, so that's all we model here.
 */
export function createMockAuth(user?: { userId: string }): () => Promise<ClerkAuthResult> {
  return async () => user ?? null;
}

