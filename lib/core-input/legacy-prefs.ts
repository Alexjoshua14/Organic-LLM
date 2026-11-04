import type { CoreInputSettings } from "./settings";

import { CHAT_EFFORT_LEVELS, type ChatEffortLevel } from "@/lib/schemas/chat-effort";
import { ChatModels } from "@/lib/schemas/chat";

/**
 * The pre-snapshot composer prefs: one localStorage key per setting, shared by every
 * CoreInput without a scope, expiring 24h after the last visit. Scoped CoreInputs still
 * read them as the final fallback and write them on user changes, so an unscoped surface
 * keeps opening with the last settings used anywhere.
 */
export type LegacyPrefKeys = {
  model: string;
  effort: string;
  memories: string;
};

const WEB_SEARCH_KEY = "organic-llm-web-search";
const SPEECH_FRIENDLY_KEY = "organic-llm-speech-friendly";
const TIMESTAMP_KEY = "organic-llm-prefs-timestamp";
const EXPIRY_MS = 24 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function readBoolean(storage: StorageLike, key: string, fallback: boolean): boolean {
  const stored = storage.getItem(key);

  if (stored === "true") return true;
  if (stored === "false") return false;

  return fallback;
}

/**
 * Reads the legacy prefs, clearing them when expired. A read that finds them fresh refreshes
 * the timestamp, so expiry counts from the last visit rather than the last change (as when
 * every mount re-wrote them).
 */
export function readLegacyComposerPrefs(
  storage: StorageLike,
  keys: LegacyPrefKeys,
  defaults: CoreInputSettings,
  now = Date.now()
): CoreInputSettings {
  const timestamp = storage.getItem(TIMESTAMP_KEY);

  if (!timestamp || now - parseInt(timestamp, 10) > EXPIRY_MS) {
    for (const key of [
      keys.model,
      keys.effort,
      keys.memories,
      WEB_SEARCH_KEY,
      SPEECH_FRIENDLY_KEY,
      TIMESTAMP_KEY,
    ]) {
      storage.removeItem(key);
    }

    return defaults;
  }

  storage.setItem(TIMESTAMP_KEY, String(now));

  const storedModel = storage.getItem(keys.model);
  const storedEffort = storage.getItem(keys.effort);

  return {
    ...defaults,
    modelId: ChatModels.some((m) => m.id === storedModel) ? storedModel! : defaults.modelId,
    effort: CHAT_EFFORT_LEVELS.some((row) => row.id === storedEffort)
      ? (storedEffort as ChatEffortLevel)
      : defaults.effort,
    webSearch: readBoolean(storage, WEB_SEARCH_KEY, defaults.webSearch),
    memories: readBoolean(storage, keys.memories, defaults.memories),
    speechFriendly: readBoolean(storage, SPEECH_FRIENDLY_KEY, defaults.speechFriendly),
  };
}

export function writeLegacyComposerPrefs(
  storage: StorageLike,
  keys: LegacyPrefKeys,
  settings: CoreInputSettings,
  now = Date.now()
): void {
  storage.setItem(keys.model, settings.modelId);
  storage.setItem(keys.effort, settings.effort);
  storage.setItem(keys.memories, String(settings.memories));
  storage.setItem(WEB_SEARCH_KEY, String(settings.webSearch));
  storage.setItem(SPEECH_FRIENDLY_KEY, String(settings.speechFriendly));
  storage.setItem(TIMESTAMP_KEY, String(now));
}
