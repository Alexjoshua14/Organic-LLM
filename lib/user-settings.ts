/**
 * User settings: always cached in localStorage for fast reads/writes.
 * Supabase grabbers (in data/supabase/user-settings) can be wired to sync when backend is set up.
 */

import {
  UserSettingsSchema,
  defaultUserSettings,
  type UserSettings,
} from "@/lib/schemas/userSettings";

const USER_SETTINGS_STORAGE_KEY = "organic-llm-user-settings";
const LEGACY_FONT_KEY = "organic-llm-font";

function safeParse(stored: string | null): UserSettings {
  if (!stored) return defaultUserSettings();
  try {
    const parsed = JSON.parse(stored);
    return UserSettingsSchema.parse(parsed);
  } catch {
    return defaultUserSettings();
  }
}

/** One-time migration from legacy organic-llm-font key into unified settings. */
function migrateFromLegacy(): UserSettings {
  const legacy = localStorage.getItem(LEGACY_FONT_KEY);
  if (!legacy) return defaultUserSettings();
  const settings = { ...defaultUserSettings(), fontId: legacy };
  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  localStorage.removeItem(LEGACY_FONT_KEY);
  return settings;
}

/** Read settings from localStorage (always used as cache). */
export function getSettings(): UserSettings {
  if (typeof window === "undefined") return defaultUserSettings();
  const stored = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
  if (!stored) return migrateFromLegacy();
  return safeParse(stored);
}

/** Current font id from settings (convenience). */
export function getFontId(): string {
  return getSettings().fontId;
}

/**
 * Write settings to localStorage (always).
 * When Supabase is set up: call persistUserSettingsToSupabase(clerkUserId, getSettings()) after this (e.g. in the same handler).
 * On app load / after login: call fetchUserSettingsFromSupabase(clerkUserId) and if non-null, setSettings(remote) to hydrate cache.
 */
export function setSettings(partial: Partial<UserSettings>): UserSettings {
  if (typeof window === "undefined") return defaultUserSettings();
  const current = getSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Storage key for code that needs it (e.g. migration or debugging). */
export { USER_SETTINGS_STORAGE_KEY };
