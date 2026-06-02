export type HealthStatus = "ok" | "degraded" | "down" | "skipped";

export type HealthCheckResult = {
  id: string;
  displayName: string;
  status: HealthStatus;
  latencyMs: number | null;
  summary: string;
  message?: string;
  config?: Record<string, string>;
};

export type HealthReport = {
  checkedAt: string;
  overall: HealthStatus;
  checks: HealthCheckResult[];
};
