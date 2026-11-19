/**
 * Named app rate-limit buckets. Caps/windows here are the source of truth for
 * constructors in `lib/rate-limit/*.ts` and for developer logs when a deny happens.
 */
export type RateLimitWindow = "1 m" | "1 h" | "1 d";

export type RateLimitCatalogEntry = {
  /** Stable id for logs (`memory.search`, `llm.message`, …). */
  id: string;
  /** Upstash key prefix. */
  prefix: string;
  cap: number;
  window: RateLimitWindow;
  /** User-facing / Result.error string returned on deny. */
  error: string;
  /** Why this bucket exists and what consumes a token. */
  why: string;
};

export const MEMORY_WIPE_RATE_LIMIT = {
  id: "memory.wipe",
  prefix: "ratelimit:memory:wipe",
  cap: 3,
  window: "1 h",
  error: "Too many wipe requests",
  why: "Mem0 wipe. One token per wipe call.",
} as const satisfies RateLimitCatalogEntry;

export const MEMORY_DELETE_RATE_LIMIT = {
  id: "memory.delete",
  prefix: "ratelimit:memory:delete",
  cap: 30,
  window: "1 h",
  error: "Too many delete requests",
  why: "Mem0 single-memory delete. One token per delete.",
} as const satisfies RateLimitCatalogEntry;

export const MEMORY_SEARCH_RATE_LIMIT = {
  id: "memory.search",
  prefix: "ratelimit:memory:search",
  cap: 60,
  window: "1 m",
  error: "Too many search requests",
  why: "Mem0 semantic search. Each uncached search consumes one token. Arcadia Instant uses 1 search per turn; Quick uses up to 3 in parallel; Heavy uses up to 3 plus an optional 4th. L1 cache hits do not consume this bucket.",
} as const satisfies RateLimitCatalogEntry;

export const MEMORY_LIST_RATE_LIMIT = {
  id: "memory.list",
  prefix: "ratelimit:memory:list",
  cap: 60,
  window: "1 m",
  error: "Too many list requests",
  why: "Mem0 list/get-all. One token per list call.",
} as const satisfies RateLimitCatalogEntry;

export const MEMORY_ADD_RATE_LIMIT = {
  id: "memory.add",
  prefix: "ratelimit:memory:add",
  cap: 120,
  window: "1 h",
  error: "Too many memory add requests",
  why: "Mem0 ingest (chat-turn add). One token per add, including post-turn memory write.",
} as const satisfies RateLimitCatalogEntry;

export const MEMORY_FEEDBACK_RATE_LIMIT = {
  id: "memory.feedback",
  prefix: "ratelimit:memory:feedback",
  cap: 60,
  window: "1 m",
  error: "Too many feedback requests",
  why: "One token per feedback mutation, before memory ownership reads.",
} as const satisfies RateLimitCatalogEntry;

export const LLM_MESSAGE_RATE_LIMIT = {
  id: "llm.message",
  prefix: "ratelimit:llm:message",
  cap: Number.parseInt(process.env.LLM_RATE_LIMIT_MESSAGES ?? "60", 10) || 60,
  window: "1 m",
  error: "Too many LLM requests",
  why: "One token per chat POST (checked before context assembly). The Arcadia typed planner does not consume a second llm.message token.",
} satisfies RateLimitCatalogEntry;

export const AION_PRESENCE_MINUTE_RATE_LIMIT = {
  id: "aion.presence.minute",
  prefix: "ratelimit:aion:presence-minute",
  cap: Number.parseInt(process.env.AION_PRESENCE_PER_MINUTE_CAP ?? "12", 10) || 12,
  window: "1 m",
  error: "Too many Aion presence micro-turns",
  why: "Aion presence Tier-1 micro-turns per minute. One token per /api/ai/aion/event call that reaches generateText.",
} as const satisfies RateLimitCatalogEntry;

export const AION_PRESENCE_DAILY_TURN_RATE_LIMIT = {
  id: "aion.presence.daily-turns",
  prefix: "ratelimit:aion:presence-daily-turns",
  cap: Number.parseInt(process.env.AION_PRESENCE_DAILY_TURN_CAP ?? "200", 10) || 200,
  window: "1 d",
  error: "Daily Aion presence turn limit exceeded",
  why: "Aion presence Tier-1 micro-turns per day. One token per billed micro-turn.",
} as const satisfies RateLimitCatalogEntry;

/**
 * Agent test accounts only (lib/agent-account/agent-account.ts). Checked in `proxy.ts` before
 * any route runs, keyed by Clerk id, so one looping agent cannot flood Clerk, Supabase, Redis
 * or the Aetherion-hosted services. Every other account skips these buckets.
 */
const AGENT_ALL_WHY =
  "Agent test account: one token per request the proxy matches (pages, API, server actions).";
const AGENT_WRITE_WHY =
  "Agent test account: one token per non-GET/HEAD/OPTIONS request, server actions included.";

export const AGENT_ALL_MINUTE_RATE_LIMIT = {
  id: "agent.all.minute",
  prefix: "ratelimit:agent:all-minute",
  cap: 20,
  window: "1 m",
  error: "Agent account request limit reached (per minute)",
  why: AGENT_ALL_WHY,
} as const satisfies RateLimitCatalogEntry;

export const AGENT_ALL_HOUR_RATE_LIMIT = {
  id: "agent.all.hour",
  prefix: "ratelimit:agent:all-hour",
  cap: 200,
  window: "1 h",
  error: "Agent account request limit reached (per hour)",
  why: AGENT_ALL_WHY,
} as const satisfies RateLimitCatalogEntry;

export const AGENT_ALL_DAY_RATE_LIMIT = {
  id: "agent.all.day",
  prefix: "ratelimit:agent:all-day",
  cap: 1_000,
  window: "1 d",
  error: "Agent account request limit reached (per day)",
  why: AGENT_ALL_WHY,
} as const satisfies RateLimitCatalogEntry;

export const AGENT_WRITE_MINUTE_RATE_LIMIT = {
  id: "agent.write.minute",
  prefix: "ratelimit:agent:write-minute",
  cap: 6,
  window: "1 m",
  error: "Agent account write limit reached (per minute)",
  why: AGENT_WRITE_WHY,
} as const satisfies RateLimitCatalogEntry;

export const AGENT_WRITE_DAY_RATE_LIMIT = {
  id: "agent.write.day",
  prefix: "ratelimit:agent:write-day",
  cap: 60,
  window: "1 d",
  error: "Agent account write limit reached (per day)",
  why: AGENT_WRITE_WHY,
} as const satisfies RateLimitCatalogEntry;

export const AGENT_ALL_RATE_LIMITS = [
  AGENT_ALL_MINUTE_RATE_LIMIT,
  AGENT_ALL_HOUR_RATE_LIMIT,
  AGENT_ALL_DAY_RATE_LIMIT,
] as const;

export const AGENT_WRITE_RATE_LIMITS = [
  AGENT_WRITE_MINUTE_RATE_LIMIT,
  AGENT_WRITE_DAY_RATE_LIMIT,
] as const;

export const RATE_LIMIT_CATALOG: readonly RateLimitCatalogEntry[] = [
  MEMORY_SEARCH_RATE_LIMIT,
  MEMORY_ADD_RATE_LIMIT,
  MEMORY_LIST_RATE_LIMIT,
  MEMORY_DELETE_RATE_LIMIT,
  MEMORY_WIPE_RATE_LIMIT,
  MEMORY_FEEDBACK_RATE_LIMIT,
  LLM_MESSAGE_RATE_LIMIT,
  AION_PRESENCE_MINUTE_RATE_LIMIT,
  AION_PRESENCE_DAILY_TURN_RATE_LIMIT,
  ...AGENT_ALL_RATE_LIMITS,
  ...AGENT_WRITE_RATE_LIMITS,
];

export function catalogEntryById(id: string): RateLimitCatalogEntry | undefined {
  return RATE_LIMIT_CATALOG.find((entry) => entry.id === id);
}

export function catalogEntryByError(error: string): RateLimitCatalogEntry | undefined {
  const trimmed = error.trim();

  return RATE_LIMIT_CATALOG.find(
    (entry) => entry.error === trimmed || trimmed.includes(entry.error)
  );
}
