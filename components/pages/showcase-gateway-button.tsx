"use client";

import { useAuth } from "@clerk/nextjs";

import { GatewaySmokeLink } from "./gateway-smoke-link";

/**
 * Showcase gateway — visible to every signed-in user (public routes, no admin gate).
 */
export function ShowcaseGatewayButton() {
  const { userId } = useAuth();

  if (!userId) return null;

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
