import "server-only";

import type { InitialGatewayVisibility } from "@/hooks/use-gateway-visibility";

import { readAdminProfile } from "@/lib/admin/read-admin-profile";

/**
 * Server-rendered seed for `useGatewayVisibility`, so admin-only UI (the sidebar's Strata and
 * Stage tiles) is right on the first paint instead of popping in once the client asks.
 *
 * Runs the same `admin_access` read as `requireAdmin()`. It only decides what the first paint
 * shows; pages, models, and APIs still authorize on their own server checks.
 *
 * Returns `null` (no seed) when signed out, or when the read fails: an unknown answer is left to
 * the client check rather than rendered as a confident "not an admin".
 */
export async function resolveInitialGatewayVisibility(
  userId: string | null,
  read: typeof readAdminProfile = readAdminProfile
): Promise<InitialGatewayVisibility | null> {
  if (!userId) return null;

  try {
    return { userId, visible: (await read(userId))?.admin === true };
  } catch {
    return null;
  }
}
