import "server-only";

import type { InitialGatewayVisibility } from "@/hooks/use-gateway-visibility";

import { readLabProfileId } from "@/lib/admin/lab-access";

/**
 * Server-rendered seed for `useGatewayVisibility`, so lab-only UI (the sidebar's Strata and
 * Stage tiles) is right on the first paint instead of popping in once the client asks.
 *
 * Runs the same admin and `lab_access` reads as `requireLabAccess()`. It only decides what the
 * first paint shows; pages, models, and APIs still authorize on their own server checks.
 *
 * Returns `null` (no seed) when signed out, or when the read fails: an unknown answer is left to
 * the client check rather than rendered as a confident "no labs".
 */
export async function resolveInitialGatewayVisibility(
  userId: string | null,
  read: typeof readLabProfileId = readLabProfileId
): Promise<InitialGatewayVisibility | null> {
  if (!userId) return null;

  try {
    return { userId, visible: (await read(userId)) !== null };
  } catch {
    return null;
  }
}
