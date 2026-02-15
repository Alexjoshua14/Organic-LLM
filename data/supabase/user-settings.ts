"use server";

import type { UserSettings } from "@/lib/schemas/userSettings";

/**
 * Supabase grabbers for user settings.
 * Not wired until you add a table (e.g. user_settings or a column on profiles) and uncomment the implementation.
 *
 * Table suggestion:
 *   create table user_settings (
 *     clerk_user_id text primary key references ...,
 *     settings jsonb not null default '{}',
 *     updated_at timestamptz not null default now()
 *   );
 *
 * Then: use supabaseServer(), .from("user_settings").select().eq("clerk_user_id", clerkUserId).single()
 * and .upsert({ clerk_user_id, settings, updated_at: new Date().toISOString() }).
 */

/** Fetch user settings from Supabase. When Supabase is set up, implement and use after login to hydrate localStorage. */
export async function fetchUserSettingsFromSupabase(
  _clerkUserId: string,
): Promise<UserSettings | null> {
  // TODO: when Supabase is configured, e.g.:
  // const sb = await supabaseServer();
  // const { data, error } = await sb.from("user_settings").select("settings").eq("clerk_user_id", clerkUserId).single();
  // if (error || !data) return null;
  // return UserSettingsSchema.parse(data.settings);
  return null;
}

/** Persist user settings to Supabase. When Supabase is set up, call after setSettings() when user is logged in. */
export async function persistUserSettingsToSupabase(
  _clerkUserId: string,
  _settings: UserSettings,
): Promise<void> {
  // TODO: when Supabase is configured, e.g.:
  // const sb = await supabaseServer();
  // await sb.from("user_settings").upsert({
  //   clerk_user_id: clerkUserId,
  //   settings,
  //   updated_at: new Date().toISOString(),
  // });
}
