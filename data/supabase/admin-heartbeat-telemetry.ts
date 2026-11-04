import "server-only";

import type { HeartbeatDashboardQuery } from "@/lib/admin/heartbeat-telemetry";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export async function readAdminHeartbeatTelemetry(
  query: HeartbeatDashboardQuery
): Promise<unknown> {
  const { data, error } = await supabaseAdmin
    .rpc("read_admin_heartbeat_telemetry", {
      p_hours: query.hours,
      p_status: query.status,
      p_offset: query.offset,
      p_until: query.until,
    })
    .abortSignal(AbortSignal.timeout(10_000));

  if (error) throw new Error("Heartbeat telemetry read failed");

  return data;
}
