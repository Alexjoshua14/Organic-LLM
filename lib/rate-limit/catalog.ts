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

export const LLM_MESSAGE_RATE_LIMIT = {
  id: "llm.message",
  prefix: "ratelimit:llm:message",
  cap: Number.parseInt(process.env.LLM_RATE_LIMIT_MESSAGES ?? "60", 10) || 60,
  window: "1 m",
  error: "Too many LLM requests",
  why: "One token per chat POST (checked before context assembly). The Arcadia typed planner does not consume a second llm.message token.",
} satisfies RateLimitCatalogEntry;

export const RATE_LIMIT_CATALOG: readonly RateLimitCatalogEntry[] = [
  MEMORY_SEARCH_RATE_LIMIT,
  MEMORY_ADD_RATE_LIMIT,
  MEMORY_LIST_RATE_LIMIT,
  MEMORY_DELETE_RATE_LIMIT,
  MEMORY_WIPE_RATE_LIMIT,
  LLM_MESSAGE_RATE_LIMIT,
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
