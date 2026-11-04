import { requireAdmin } from "@/lib/admin/require-admin";
import { readAdminHeartbeatTelemetry } from "@/data/supabase/admin-heartbeat-telemetry";
import { createHeartbeatTelemetryHandler } from "@/lib/api/heartbeat-telemetry-handler";

export const GET = createHeartbeatTelemetryHandler({
  requireAdmin,
  read: readAdminHeartbeatTelemetry,
});
