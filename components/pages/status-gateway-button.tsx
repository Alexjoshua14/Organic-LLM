"use client";

import { GatewaySmokeLink } from "./gateway-smoke-link";

import { useGatewayVisibility } from "@/hooks/use-gateway-visibility";

/**
 * Admin-only link to /status. Shares the current session's gateway visibility query.
 */
export function StatusGatewayButton({ className }: { className?: string }) {
  const { visible } = useGatewayVisibility();

  if (visible !== true) return null;

  return (
    <GatewaySmokeLink
      ariaLabel="System status"
      className={className}
      href="/status"
      label="Status"
    />
  );
}
