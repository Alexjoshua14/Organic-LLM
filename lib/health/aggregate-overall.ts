import type { HealthCheckResult, HealthStatus } from "@/lib/health/types";

export function aggregateOverall(checks: HealthCheckResult[]): HealthStatus {
  if (checks.length === 0) return "skipped";
  if (checks.every((c) => c.status === "skipped")) return "skipped";
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";

  return "ok";
}
