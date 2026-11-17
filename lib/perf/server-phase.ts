import "server-only";

import { cache } from "react";

export type ServerPhaseRecord = {
  name: string;
  ms: number;
};

const STASH_TTL_MS = 30_000;

type StashEntry = {
  phases: ServerPhaseRecord[];
  expiresAt: number;
};

const STASH_KEY = Symbol.for("organic-llm:perf-server-phase-stash");

type StashMap = Map<string, StashEntry>;

function getStashMap(): StashMap {
  const g = globalThis as typeof globalThis & { [STASH_KEY]?: StashMap };

  if (!g[STASH_KEY]) {
    g[STASH_KEY] = new Map();
  }

  return g[STASH_KEY]!;
}

function pruneExpired(map: StashMap): void {
  const now = Date.now();

  for (const [key, entry] of map) {
    if (entry.expiresAt <= now) {
      map.delete(key);
    }
  }
}

/** Per-request collector shared by generateMetadata and page via React cache(). */
export const createRequestPhaseCollector = cache((): ServerPhaseRecord[] => []);

/**
 * Times a step inside the current request, into the collector the page ships to the browser.
 * Usable from deep in the data layer; outside a page render it times and discards.
 */
export function timeRequestPhase<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return timeServerPhase(createRequestPhaseCollector(), name, fn);
}

/**
 * Records a step that was timed in place. Adds no await, so it cannot change when the code
 * around it runs (some callers depend on reads starting within a single tick).
 */
export function recordRequestPhase(name: string, startedAt: number): void {
  createRequestPhaseCollector().push({ name, ms: performance.now() - startedAt });
}

export async function timeServerPhase<T>(
  collector: ServerPhaseRecord[],
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    return await fn();
  } finally {
    collector.push({ name, ms: performance.now() - start });
  }
}

export function stashServerPhases(key: string, phases: ServerPhaseRecord[]): void {
  const map = getStashMap();

  pruneExpired(map);
  map.set(key, { phases: [...phases], expiresAt: Date.now() + STASH_TTL_MS });
}

export function takeServerPhases(key: string): ServerPhaseRecord[] {
  const map = getStashMap();

  pruneExpired(map);
  const entry = map.get(key);

  if (!entry) return [];

  map.delete(key);

  return entry.phases;
}
