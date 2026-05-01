/**
 * Canonical `/api/chat` experience tokens. Client may send any casing; use {@link parseChatExperience}.
 */
export const CHAT_EXPERIENCES = ["arcadia", "strata_hub", "strata_page", "delphi"] as const;

export type ChatExperience = (typeof CHAT_EXPERIENCES)[number];

const CANONICAL_SET = new Set<string>(CHAT_EXPERIENCES);

/** Lowercase trim; returns a canonical token only when it matches {@link CHAT_EXPERIENCES}. */
export function parseChatExperience(raw: string | undefined): ChatExperience | undefined {
  if (raw === undefined || raw === null) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "") return undefined;
  if (!CANONICAL_SET.has(normalized)) return undefined;
  return normalized as ChatExperience;
}
