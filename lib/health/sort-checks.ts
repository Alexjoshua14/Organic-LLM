import type { HealthCheckResult, HealthStatus } from "@/lib/health/types";

const SEVERITY: Record<HealthStatus, number> = {
  down: 0,
  degraded: 1,
  skipped: 2,
  ok: 3,
};

export function compareChecksBySeverity(a: HealthCheckResult, b: HealthCheckResult): number {
  const diff = SEVERITY[a.status] - SEVERITY[b.status];

  if (diff !== 0) return diff;

  return a.displayName.localeCompare(b.displayName);
}

export function sortChecksBySeverity(checks: HealthCheckResult[]): HealthCheckResult[] {
  return [...checks].sort(compareChecksBySeverity);
}
