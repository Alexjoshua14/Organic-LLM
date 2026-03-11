export type ClerkAuthUser = { userId: string | null };
export type ClerkAuthResult = ClerkAuthUser;

/**
 * Shared Clerk user fixture for route/component tests that only need a userId.
 */
export function createMockClerkUser(
  userId: string = "clerk_test_user",
): ClerkAuthUser {
  return { userId };
}

/**
 * Shared async implementation for Clerk's `auth()` helper.
 * Tests can wrap this with Bun's `mock(...)` when they need assertions.
 */
export function createMockAuth(user: ClerkAuthResult = createMockClerkUser()) {
  return async () => user;
}

