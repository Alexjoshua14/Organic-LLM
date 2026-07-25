"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { getShowSandboxGatewayForCurrentUser } from "@/data/supabase/profiles";

/** Cache per signed-in user so we don't refetch on every mount. */
const isAdminCache = new Map<string, boolean>();

/**
 * Whether the signed-in user passes the admin gate (profiles.admin — the same
 * check as /admin and the sandbox gateway). `null` while resolving, `false`
 * when signed out.
 */
export function useIsAdmin(): boolean | null {
  const { userId } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(() =>
    userId ? (isAdminCache.get(userId) ?? null) : false
  );

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);

      return;
    }
    const cached = isAdminCache.get(userId);

    if (cached !== undefined) {
      setIsAdmin(cached);

      return;
    }
    setIsAdmin(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      isAdminCache.set(userId, value);
      setIsAdmin(value);
    });
  }, [userId]);

  return isAdmin;
}
