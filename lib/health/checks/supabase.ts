import "server-only";

import type { HealthCheckResult } from "@/lib/health/types";
import { HEALTH_CHECK_TIMEOUT_MS, withTimeout } from "@/lib/health/with-timeout";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

function supabaseConfig(): Record<string, string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw */
  }
  return {
    host,
    serviceRoleConfigured: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "yes" : "no",
  };
}

export async function checkSupabase(): Promise<HealthCheckResult> {
  const start = performance.now();
  const config = supabaseConfig();

  const base: Omit<HealthCheckResult, "status" | "latencyMs" | "summary"> = {
    id: "supabase",
    displayName: "Supabase",
    config,
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return {
      ...base,
      status: "skipped",
      latencyMs: null,
      summary: "Not configured",
      message: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return withTimeout(
    HEALTH_CHECK_TIMEOUT_MS,
    async () => {
      try {
        const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
        const latencyMs = Math.round(performance.now() - start);

        if (error) {
          return {
            ...base,
            status: "down",
            latencyMs,
            summary: error.message.length > 80 ? `${error.message.slice(0, 77)}…` : error.message,
            message: error.message,
          };
        }

        return {
          ...base,
          status: "ok",
          latencyMs,
          summary: "Reachable",
        };
      } catch (error) {
        const latencyMs = Math.round(performance.now() - start);
        const message = error instanceof Error ? error.message : String(error);
        return {
          ...base,
          status: "down",
          latencyMs,
          summary: message.length > 80 ? `${message.slice(0, 77)}…` : message,
          message,
        };
      }
    },
    () => ({
      ...base,
      status: "down",
      latencyMs: HEALTH_CHECK_TIMEOUT_MS,
      summary: "Request timed out",
      message: `No response within ${HEALTH_CHECK_TIMEOUT_MS}ms`,
    })
  );
}
