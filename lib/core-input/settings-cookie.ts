import type { CoreInputScope } from "./scopes";
import type { CoreInputSettings } from "./settings";
import type { SnapshotEntries } from "./snapshot-codec";

import { decodeSnapshot, hashScopeKey } from "./snapshot-codec";

import { clampEffortForModel } from "@/lib/schemas/chat-effort";

export const CORE_INPUT_COOKIE_NAME = "core_input";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const RECENT_SCOPE_LIMIT = 8;
const AREA_HASHES = new Set(["chat", "arcadia", "aion", "rabbit-holes"].map(hashScopeKey));
const MAX_ENTRIES = AREA_HASHES.size + RECENT_SCOPE_LIMIT;
const MAX_COOKIE_LENGTH = 512;

export type CoreInputCookieFlags = {
  experimentalContextEffort: boolean;
  experimentalArcadiaMarkdownPreview: boolean;
};
export type CoreInputCookie = CoreInputCookieFlags & { entries: Array<[number, number]> };
export type CoreInputInitialSettings = CoreInputCookieFlags & {
  scopeKey: string;
  settings: CoreInputSettings;
};

/** Keep area fallbacks even when many threads have been visited. Entries are oldest first. */
export function selectCookieEntries(entries: SnapshotEntries): Array<[number, number]> {
  const areas = entries.filter(([key]) => AREA_HASHES.has(key));
  const recent = entries.filter(([key]) => !AREA_HASHES.has(key)).slice(-RECENT_SCOPE_LIMIT);

  return [...areas, ...recent].map(([key, value]) => [key, value]);
}

export function encodeSettingsCookie(cookie: CoreInputCookie): string {
  const flags =
    Number(cookie.experimentalContextEffort) |
    (Number(cookie.experimentalArcadiaMarkdownPreview) << 1);

  return [
    "1",
    flags.toString(),
    ...selectCookieEntries(cookie.entries).map(
      ([key, value]) => `${key.toString(36)}.${value.toString(36)}`
    ),
  ].join("_");
}

/** Untrusted preference hint only. Unknown models, versions, and malformed numbers are absent. */
export function decodeSettingsCookie(raw: string | undefined): CoreInputCookie | null {
  if (!raw || raw.length > MAX_COOKIE_LENGTH) return null;
  const [version, flags, ...rows] = raw.split("_");

  if (version !== "1" || !/^[0-3]$/.test(flags ?? "") || rows.length > MAX_ENTRIES) return null;
  const entries: Array<[number, number]> = [];
  const seen = new Set<number>();

  for (const row of rows) {
    if (!/^[0-9a-z]{1,11}\.[0-9a-z]{1,8}$/.test(row)) return null;
    const [key, value] = row.split(".").map((part) => parseInt(part, 36));

    if (!Number.isSafeInteger(key) || key < 0 || seen.has(key)) return null;
    const decoded = decodeSnapshot(value);

    if (!decoded?.modelId) return null;
    seen.add(key);
    entries.push([key, value]);
  }

  return {
    experimentalContextEffort: (Number(flags) & 1) !== 0,
    experimentalArcadiaMarkdownPreview: (Number(flags) & 2) !== 0,
    entries,
  };
}

/** Same key/inheritance order as the local store; never persist a side-thread's settings. */
export function resolveCookieSettings(
  cookie: CoreInputCookie | null,
  scope: CoreInputScope
): CoreInputInitialSettings | null {
  if (!cookie || scope.ephemeral) return null;
  const entries = new Map(cookie.entries);

  for (const key of [scope.key, ...(scope.inheritFrom ?? [])]) {
    const value = entries.get(hashScopeKey(key));
    const stored = value === undefined ? null : decodeSnapshot(value);

    if (stored?.modelId) {
      return {
        scopeKey: scope.key,
        experimentalContextEffort: cookie.experimentalContextEffort,
        experimentalArcadiaMarkdownPreview: cookie.experimentalArcadiaMarkdownPreview,
        settings: {
          ...stored,
          modelId: stored.modelId,
          effort: clampEffortForModel(stored.modelId, stored.effort),
        },
      };
    }
  }

  return null;
}

/** Merge either snapshots or flags without erasing the other half of the mirror. */
export function writeSettingsCookie(update: Partial<CoreInputCookie>): void {
  if (typeof document === "undefined") return;
  try {
    const raw = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CORE_INPUT_COOKIE_NAME}=`))
      ?.slice(CORE_INPUT_COOKIE_NAME.length + 1);
    const previous = decodeSettingsCookie(raw) ?? {
      entries: [],
      experimentalContextEffort: false,
      experimentalArcadiaMarkdownPreview: false,
    };
    const value = encodeSettingsCookie({ ...previous, ...update });
    const secure = document.location.protocol === "https:" ? "; Secure" : "";

    document.cookie = `${CORE_INPUT_COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // A blocked cookie must never prevent a preference change or a send.
  }
}
