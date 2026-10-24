"use client";

import { useGatewayVisibility } from "@/hooks/use-gateway-visibility";

/**
 * Admin UI visibility. `null` while resolving and `false` when signed out or unavailable.
 * This client hint is never an authorization check.
 */
export function useIsAdmin(): boolean | null {
  return useGatewayVisibility().visible;
}
