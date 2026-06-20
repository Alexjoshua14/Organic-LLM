"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { GatewaySmokeLink } from "./gateway-smoke-link";

import { getShowSandboxGatewayForCurrentUser } from "@/data/supabase/profiles";

/** Cache per signed-in user so we don't refetch on every mount. Shared with ShowcaseGatewayButton. */
export const showGatewayCache = new Map<string, boolean>();

/**
 * Renders a Sandbox Gateway entry when the signed-in user's profile has admin
 * (profiles.admin). Defaults to showing until the column exists; once you add
 * the admin column, only users with admin true see the button. Cached per user.
 */
export function SandboxGatewayButton() {
  const { userId } = useAuth();
  const [showSandbox, setShowSandbox] = useState<boolean | null>(() =>
    userId ? (showGatewayCache.get(userId) ?? null) : null
  );

  useEffect(() => {
    if (!userId) return;
    const cached = showGatewayCache.get(userId);

    if (cached !== undefined) {
      setShowSandbox(cached);

      return;
    }
    setShowSandbox(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      showGatewayCache.set(userId, value);
      setShowSandbox(value);
    });
  }, [userId]);

  if (!userId || showSandbox === false) return null;

  return (
    <GatewaySmokeLink
      ariaLabel="Open Sandbox"
      href="/sandbox"
      label="Sandbox"
      motionDelay={0.4}
      showArrow
    />
  );
}
