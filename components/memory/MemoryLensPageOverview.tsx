"use client";

import { use, useEffect, useRef } from "react";

type OverviewResult = { ok: true; overview: string } | { ok: false; error: string };

const CLIENT_OVERVIEW_CACHE_MAX = 48;
const clientOverviewCache = new Map<string, OverviewResult>();

function overviewClientCacheKey(memoryIds: readonly string[]) {
  return memoryIds.join("\u0000");
}

/** Clears in-memory overview cache (e.g. after a memory delete so text can change under the same id). */
export function clearMemoryLensOverviewClientCache() {
  clientOverviewCache.clear();
}

function loadOverview(memoryIds: readonly string[], signal: AbortSignal): Promise<OverviewResult> {
  const key = overviewClientCacheKey(memoryIds);
  const cached = clientOverviewCache.get(key);

  if (cached?.ok === true) {
    return Promise.resolve(cached);
  }

  return fetch("/api/memory/lens-overview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memoryIds: [...memoryIds],
    }),
    signal,
  })
    .then(async (r) => {
      const data = (await r.json().catch(() => ({}))) as { overview?: string; error?: string };

      if (!r.ok) {
        return {
          ok: false as const,
          error: typeof data.error === "string" ? data.error : "Could not load summary",
        };
      }

      if (typeof data.overview !== "string") {
        return { ok: false as const, error: "Invalid response" };
      }

      const ok: OverviewResult = { ok: true as const, overview: data.overview };

      if (clientOverviewCache.size >= CLIENT_OVERVIEW_CACHE_MAX) {
        const first = clientOverviewCache.keys().next().value;

        if (first !== undefined) clientOverviewCache.delete(first);
      }
      clientOverviewCache.set(key, ok);

      return ok;
    })
    .catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false as const, error: "" };
      }
      const msg = e instanceof Error ? e.message : "Could not load summary";

      return { ok: false as const, error: msg };
    });
}

function MemoryLensPageOverviewInner({ memoryIds }: { memoryIds: string[] }) {
  const promiseRef = useRef<Promise<OverviewResult> | null>(null);
  const acRef = useRef<AbortController | null>(null);

  if (!promiseRef.current) {
    const ac = new AbortController();

    acRef.current = ac;
    promiseRef.current = loadOverview(memoryIds, ac.signal);
  }

  useEffect(() => {
    return () => {
      acRef.current?.abort();
    };
  }, []);

  const res = use(promiseRef.current);

  if (!res.ok) {
    if (!res.error) return null;

    return (
      <p className="text-sm text-muted-foreground" role="status">
        {res.error}
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5 whitespace-pre-wrap">
      {res.overview}
    </p>
  );
}

/** Remount when `memoryIds` change so fetches abort and Suspense shows fallback again. */
export function MemoryLensPageOverview({ memoryIds }: { memoryIds: string[] }) {
  const stableKey = memoryIds.join("\u0000");

  return <MemoryLensPageOverviewInner key={stableKey} memoryIds={memoryIds} />;
}
