"use client";

import { GatewaySmokeLink } from "./gateway-smoke-link";

import { useGatewayVisibility } from "@/hooks/use-gateway-visibility";

/**
 * Renders a Sandbox Gateway entry for an admin_access member.
 * Visibility is shared across entry points for the current session.
 */
export function SandboxGatewayButton() {
  const { visible } = useGatewayVisibility();

  if (visible !== true) return null;

  return <GatewaySmokeLink ariaLabel="Open Sandbox" href="/sandbox" label="Sandbox" showArrow />;
}
