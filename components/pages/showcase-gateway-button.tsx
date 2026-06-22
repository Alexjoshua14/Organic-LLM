"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { GatewaySmokeLink } from "./gateway-smoke-link";
import { showGatewayCache } from "./sandbox-gateway-button";

import { getShowSandboxGatewayForCurrentUser } from "@/data/supabase/profiles";

/**
 * Renders a Showcase gateway entry when the signed-in user can see the sandbox
 * (same visibility as SandboxGatewayButton). Uses shared showGatewayCache.
 */
export function ShowcaseGatewayButton() {
  const { userId } = useAuth();
  const [show, setShow] = useState<boolean | null>(() =>
    userId ? (showGatewayCache.get(userId) ?? null) : null
  );

  useEffect(() => {
    if (!userId) return;
    const cached = showGatewayCache.get(userId);

    if (cached !== undefined) {
      setShow(cached);

      return;
    }
    setShow(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      showGatewayCache.set(userId, value);
      setShow(value);
    });
  }, [userId]);

  if (!userId || show === false) return null;

  return (
    <GatewaySmokeLink
      ariaLabel="Open Showcase"
      href="/showcase"
      label="Showcase"
      motionDelay={0.45}
      showArrow
    />
  );
}
