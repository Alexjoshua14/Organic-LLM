/**
 * Full-page settings (Profile / Appearance / Memory) naming.
 * Swap SETTINGS_PAGE_TITLE to any of SETTINGS_PAGE_TITLE_ALTERNATIVES to change the header.
 */
export const SETTINGS_PAGE_TITLE = "Preferences";

/** Tabs on the full settings page. `advanced` renders only when dev settings are enabled. */
export const SETTINGS_PAGE_TABS = [
  "profile",
  "connectors",
  "chats",
  "memory",
  "appearance",
  "ai",
  "privacy",
  "advanced",
] as const;

export type SettingsPageTab = (typeof SETTINGS_PAGE_TABS)[number];

export function isSettingsPageTab(value: string | null | undefined): value is SettingsPageTab {
  return Boolean(value && (SETTINGS_PAGE_TABS as readonly string[]).includes(value));
}

/**
 * 10 alternative names for the full settings/profile/memory page (better than "Settings"):
 * 1. Preferences  — clear, standard
 * 2. Account      — identity-focused
 * 3. Me           — minimal, personal
 * 4. Your space   — ownership, customization
 * 5. Studio       — creative / workspace vibe
 * 6. Workspace    — productivity
 * 7. Profile & preferences — explicit
 * 8. Hub          — central place
 * 9. Control center — power-user feel
 * 10. Personal    — private / you
 */
export const SETTINGS_PAGE_TITLE_ALTERNATIVES = [
  "Preferences",
  "Account",
  "Me",
  "Your space",
  "Studio",
  "Workspace",
  "Profile & preferences",
  "Hub",
  "Control center",
  "Personal",
] as const;
