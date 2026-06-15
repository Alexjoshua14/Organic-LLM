import "server-only";

import type { HealthReport } from "@/lib/health/types";

import { aggregateOverall } from "@/lib/health/aggregate-overall";
import { checkMemoryQdrant } from "@/lib/health/checks/memory-qdrant";
import { checkOllama } from "@/lib/health/checks/ollama";
import { checkSupabase } from "@/lib/health/checks/supabase";
import { checkUpstash } from "@/lib/health/checks/upstash";
import { sortChecksBySeverity } from "@/lib/health/sort-checks";

export type RunHealthChecksOptions = {
  deep?: boolean;
};

export async function runHealthChecks(options: RunHealthChecksOptions = {}): Promise<HealthReport> {
  const deep = options.deep ?? true;

  const [ollama, memory, supabase, upstash] = await Promise.all([
    checkOllama(),
    checkMemoryQdrant(deep),
    checkSupabase(),
    checkUpstash(),
  ]);

  const checks = sortChecksBySeverity([ollama, memory, supabase, upstash]);

  return {
    checkedAt: new Date().toISOString(),
    overall: aggregateOverall(checks),
    checks,
  };
}
