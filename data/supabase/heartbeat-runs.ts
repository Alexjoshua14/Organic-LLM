import "server-only";

import type { HeartbeatRunTelemetry } from "@/lib/llm/subagents/heartbeat/telemetry";

import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const logger = createLogger("data/supabase/heartbeat-runs.ts");

export async function recordHeartbeatRun(run: HeartbeatRunTelemetry): Promise<void> {
  try {
    // Explicit allowlist: never persist content or arbitrary provider metadata.
    const { error } = await supabaseAdmin
      .from("heartbeat_runs")
      .insert({
        id: run.id,
        owner_id: run.owner_id,
        thread_id: run.thread_id,
        started_at: run.started_at,
        duration_ms: run.duration_ms,
        status: run.status,
        stage: run.stage,
        subagent_count: run.subagent_count,
        evaluation_attempted: run.evaluation_attempted,
        evaluation_duration_ms: run.evaluation_duration_ms,
        event_count: run.event_count,
        model_id: run.model_id,
        input_tokens: run.input_tokens,
        output_tokens: run.output_tokens,
        total_tokens: run.total_tokens,
        cost_usd: run.cost_usd,
        generation_id: run.generation_id,
        provider: run.provider,
        error_code: run.error_code,
      })
      .abortSignal(AbortSignal.timeout(3000));

    if (error) {
      logger.warn("recordHeartbeatRun", "Heartbeat telemetry insert failed", run.id);
    }
  } catch {
    logger.warn("recordHeartbeatRun", "Heartbeat telemetry insert failed", run.id);
  }
}
