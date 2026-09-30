/**
 * Local, content-addressed cache for generated demo threads.
 *
 * **Storage:** a plain JSON file under `data/noesis/` (gitignored). We deliberately do
 * NOT use `bun:sqlite` here: Next.js runs its own Node server (`next start` / `next dev`),
 * so a Bun-only builtin would fail at runtime in API routes. A JSON file keeps the
 * approved intent — local, zero-infra, persists across restarts, no migration — while
 * remaining Node-safe. Swap to Supabase/SQLite later if cross-device sharing is wanted.
 *
 * Keyed by the demo version hash (see `./version.ts`): identical prompt inputs reuse the
 * same entry, so reverting to a previous prompt version is a free cache hit.
 */
import "server-only";

import type { DemoTurn, DemoUsage } from "./types";

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/sandbox/noesis/demo/cache.ts");

/** Process-cwd-relative so it resolves under whichever checkout is serving. */
const CACHE_FILE = join(process.cwd(), "data", "noesis", "demo-cache.json");

export type DemoCacheEntry = {
  transcript: DemoTurn[];
  usage: DemoUsage | null;
  model: string | null;
  createdAt: number;
};

type CacheShape = Record<string, DemoCacheEntry>;

/** In-process copy, lazily loaded from disk on first access. */
let memory: CacheShape | null = null;

function load(): CacheShape {
  if (memory) return memory;

  try {
    memory = existsSync(CACHE_FILE)
      ? (JSON.parse(readFileSync(CACHE_FILE, "utf8")) as CacheShape)
      : {};
  } catch (e) {
    logger.warn(
      "load",
      `Corrupt/unreadable cache, starting empty: ${e instanceof Error ? e.message : String(e)}`
    );
    memory = {};
  }

  return memory;
}

function persist(data: CacheShape): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    const tmp = `${CACHE_FILE}.tmp`;

    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, CACHE_FILE); // atomic-ish replace
  } catch (e) {
    logger.warn("persist", e instanceof Error ? e.message : String(e));
  }
}

/** Returns the cached demo for a version hash, or `null` on miss. */
export function getCachedDemo(hash: string): DemoCacheEntry | null {
  return load()[hash] ?? null;
}

/** Stores (or replaces) the cached demo for a version hash. */
export function putCachedDemo(hash: string, entry: DemoCacheEntry): void {
  const data = load();

  data[hash] = entry;
  persist(data);
}
