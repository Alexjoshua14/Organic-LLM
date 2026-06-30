import { AUTO_CHAT_MODEL, type ChatModel } from "@/lib/schemas/chat";

/** Default Search toggle for {@link CoreInput} when no stored preference exists. */
export const DEFAULT_COMPOSER_WEB_SEARCH = true;

/** Default Memory toggle for {@link CoreInput} when no stored preference exists. */
export const DEFAULT_COMPOSER_MEMORIES = true;

/** Default model picker value for new sessions / expired composer prefs. */
export const DEFAULT_COMPOSER_MODEL: ChatModel = AUTO_CHAT_MODEL;

/**
 * Composer model + tool toggles persist in `localStorage` (per browser origin).
 * Multiple windows on the same origin (e.g. two tabs on localhost:3000) share one
 * selection — intentional for continuity, but parallel side-by-side workflows on
 * the same port will mirror model/search/memory until we add per-window or
 * orchestration-scoped prefs.
 */
