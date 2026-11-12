import "server-only";

import type { PerfEvent } from "@/lib/perf/events";

import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { createLogger } from "@/lib/logger";

/**
 * Server-only access to the anonymous metrics tables and the consent record (see
 * docs/migrations/perf_metrics.sql). Uses the service role because both tables have row level
 * security on with no policies: no browser, and no signed-in user, can read or write them
 * directly. Callers must have already authenticated and authorized the request.
 */

const logger = createLogger("data/supabase/perf-metrics.ts");

/** `unavailable` = the migration is not applied or the read failed; treated as "do not collect". */
export type PerfConsentState = "on" | "off" | "unset" | "unavailable";

const CONSENT_CACHE_TTL_MS = 30_000;
const CONSENT_CACHE_MAX = 500;
const consentCache = new Map<string, { state: PerfConsentState; expiresAt: number }>();

let warnedMissing = false;

/** Postgres "undefined table" and PostgREST "not in schema cache": the migration is pending. */
export function isMissingRelation(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function noteMissingOnce(where: string) {
  if (warnedMissing) return;
  warnedMissing = true;
  logger.warn(where, "perf tables are missing; apply docs/migrations/perf_metrics.sql");
}

export async function readPerfConsent(profileId: string): Promise<PerfConsentState> {
  const hit = consentCache.get(profileId);

  if (hit && hit.expiresAt > Date.now()) return hit.state;

  const { data, error } = await supabaseAdmin
    .from("perf_metrics_consent")
    .select("enabled")
    .eq("profile_id", profileId)
    .maybeSingle();
  let state: PerfConsentState;

  if (error) {
    if (isMissingRelation(error)) noteMissingOnce("readPerfConsent");
    state = "unavailable";
  } else {
    state = data ? (data.enabled ? "on" : "off") : "unset";
  }

  // An outage is not cached for the full window, so recovery is quick.
  if (state !== "unavailable") {
    if (consentCache.size >= CONSENT_CACHE_MAX) {
      const oldest = consentCache.keys().next().value;

      if (oldest !== undefined) consentCache.delete(oldest);
    }
    consentCache.set(profileId, { state, expiresAt: Date.now() + CONSENT_CACHE_TTL_MS });
  }

  return state;
}

export async function writePerfConsent(
  profileId: string,
  enabled: boolean
): Promise<PerfConsentState> {
  const { error } = await supabaseAdmin
    .from("perf_metrics_consent")
    .upsert(
      { profile_id: profileId, enabled, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );

  if (error) {
    if (isMissingRelation(error)) noteMissingOnce("writePerfConsent");

    return "unavailable";
  }

  const state: PerfConsentState = enabled ? "on" : "off";

  // The new choice applies to the very next batch on this instance.
  consentCache.set(profileId, { state, expiresAt: Date.now() + CONSENT_CACHE_TTL_MS });

  return state;
}

/** Start of the current UTC hour: the only time resolution stored. Set here, never by clients. */
export function currentHourBucket(now: Date = new Date()): string {
  const bucket = new Date(now);

  bucket.setUTCMinutes(0, 0, 0);

  return bucket.toISOString();
}

export async function insertPerfEvents(events: readonly PerfEvent[], hour: string): Promise<void> {
  const rows = events.map((e) => ({
    hour,
    kind: e.kind,
    journey: e.journey,
    phase: e.phase,
    route: e.route,
    trigger: e.trigger,
    device: e.device,
    conn: e.conn,
    build: e.build,
    ms: e.ms,
  }));
  const { error } = await supabaseAdmin.from("perf_events").insert(rows);

  if (error) {
    if (isMissingRelation(error)) noteMissingOnce("insertPerfEvents");
    else logger.error("insertPerfEvents", "insert failed", error.code ?? "unknown");
  }
}

/** Test seam. */
export function clearPerfConsentCache() {
  consentCache.clear();
  warnedMissing = false;
}
