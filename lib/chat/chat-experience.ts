/**
 * Canonical `/api/chat` experience tokens. Client may send any casing; use {@link parseChatExperience}.
 */
export const CHAT_EXPERIENCES = [
  "arcadia",
  "topic_explore",
  "strata_hub",
  "strata_page",
  "delphi",
  "introspection",
  "rabbit_hole",
] as const;

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

/**
 * Experiences that use Arcadia-style Mem0 read (query rewrite + tiered injection).
 * `topic_explore` matches this read path but skips Mem0 writes after each turn (see run-llm-chat-stream).
 */
export function isArcadiaStyleMemoryReadExperience(
  experience: ChatExperience | undefined
): boolean {
  return experience === "arcadia" || experience === "topic_explore";
}

export function isIntrospectionExperience(experience: ChatExperience | undefined): boolean {
  return experience === "introspection";
}

export function isRabbitHoleExperience(experience: ChatExperience | undefined): boolean {
  return experience === "rabbit_hole";
}

/** Rabbit hole: read Mem0 by default; writes are disabled in run-llm-chat-stream. */
export function resolveMemoryEnabledForExperience(
  experience: ChatExperience | undefined,
  requested: boolean | undefined
): boolean {
  if (isIntrospectionExperience(experience) || isRabbitHoleExperience(experience)) {
    return requested ?? true;
  }

  return requested ?? false;
}

/** Experiences that must not auto-ingest chat turns into Mem0. */
export function shouldSkipMemoryWriteForExperience(
  experience: ChatExperience | undefined
): boolean {
  return (
    experience === "delphi" ||
    experience === "topic_explore" ||
    experience === "rabbit_hole"
  );
}
