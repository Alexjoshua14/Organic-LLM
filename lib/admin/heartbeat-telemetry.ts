import { z } from "zod";

export const HEARTBEAT_STATUSES = [
  "no-subagents",
  "unavailable",
  "too-soon",
  "unchanged",
  "claimed-elsewhere",
  "quiet",
  "notable",
  "error",
  "blocked-budget",
  "invalid-target",
] as const;
export const HEARTBEAT_PAGE_SIZE = 50;
const metric = z.number().finite().nonnegative().nullable();
const count = z.number().int().nonnegative();

// Explicit response allowlist: no owner/thread IDs, content, or provider payloads.
export const HeartbeatDashboardSchema = z.object({
  summary: z.object({
    runs: count,
    evaluations: count,
    notable: count,
    errors: count,
    input_tokens: metric,
    output_tokens: metric,
    token_samples: count,
    input_avg: metric,
    input_p50: metric,
    input_p95: metric,
    input_max: metric,
    duration_p50: metric,
    duration_p95: metric,
    evaluation_p50: metric,
    evaluation_p95: metric,
    working_avg: metric,
    working_max: metric,
    working_samples: count,
    snapshot_chars_avg: metric,
    snapshot_duration_avg: metric,
    reported_cost: metric,
    cost_samples: count,
    jev_estimated_cost: metric,
    jev_estimate_samples: count,
  }),
  statuses: z.array(z.object({ status: z.enum(HEARTBEAT_STATUSES), runs: count })),
  runs: z
    .array(
      z.object({
        id: z.string().uuid(),
        started_at: z.string(),
        status: z.enum(HEARTBEAT_STATUSES),
        stage: z.string(),
        subagent_count: metric,
        working_subagent_count: metric,
        duration_ms: metric,
        evaluation_duration_ms: metric,
        snapshot_chars: metric,
        snapshot_duration_ms: metric,
        input_tokens: metric,
        output_tokens: metric,
        cost_usd: metric,
        event_count: count,
        model_id: z.string().nullable(),
        provider: z.string().nullable(),
        error_code: z.enum(["timeout", "operation-failed"]).nullable(),
      })
    )
    .max(HEARTBEAT_PAGE_SIZE),
});
export type HeartbeatDashboardData = z.infer<typeof HeartbeatDashboardSchema>;
export type HeartbeatDashboardQuery = {
  hours: number;
  status: (typeof HEARTBEAT_STATUSES)[number] | "all";
  offset: number;
  until: string;
};
export type HeartbeatDashboardResponse = HeartbeatDashboardData & HeartbeatDashboardQuery;
