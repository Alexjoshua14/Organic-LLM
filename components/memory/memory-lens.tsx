"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUserMemories,
  getCurrentUserMemoriesBySearch,
} from "@/lib/memory/operations";
import { MemoryLensCard } from "./memory-lens-card";
import { SearchResult } from "mem0ai/oss";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type MemoryLensProps = {
  /** Inline mode (e.g. Settings tab) vs sheet (narrower, with padding) */
  variant?: "inline" | "sheet";
  className?: string;
  /** When set, show only memories matching this semantic query (e.g. for sandbox demo). */
  searchQuery?: string;
  /** Max number of memories when using searchQuery; default 5. */
  searchLimit?: number;
};

export function MemoryLens({
  variant = "inline",
  className,
  searchQuery,
  searchLimit = 5,
}: MemoryLensProps) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = searchQuery
      ? await getCurrentUserMemoriesBySearch(searchQuery, searchLimit)
      : await getCurrentUserMemories();
    if (res.error) {
      setError(res.error);
      setResult(null);
    } else {
      setResult(res.data ?? null);
    }
    setLoading(false);
  }, [searchQuery, searchLimit]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleted = useCallback(
    (id: string) => {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              results: prev.results?.filter((m) => m.id !== id) ?? [],
              relations: prev.relations ?? [],
            }
          : null
      );
    },
    []
  );

  if (loading) {
    return (
      <div
        className={cn(
          glass(),
          "rounded-2xl p-5 flex flex-col gap-4",
          variant === "sheet" && "px-2",
          className
        )}
      >
        <div className="h-8 w-48 rounded-lg bg-muted/50 animate-pulse" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-muted/30 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive",
          variant === "sheet" && "mx-2",
          className
        )}
      >
        {error}
      </div>
    );
  }

  const memories = result?.results ?? [];
  const isEmpty = memories.length === 0;

  return (
    <div
      className={cn(
        glass(),
        "rounded-2xl p-5 flex flex-col gap-5",
        variant === "sheet" && "px-2 pb-6",
        className
      )}
    >
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-cyan-400 to-emerald-500">
          Persisted memory
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          What Organic LLM has stored and can retrieve across any thread.
          Semantically searchable so the right context surfaces when you need it.
        </p>
        {searchQuery && (
          <p className="text-xs text-muted-foreground/80 italic">
            Showing up to {searchLimit} memories for: “{searchQuery}”
          </p>
        )}
      </header>

      {isEmpty ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-foreground/15 bg-background-tertiary/20 px-6 py-10 text-center",
            "text-muted-foreground text-sm"
          )}
        >
          No memories yet. Chat with memory enabled and the model will add
          important facts here over time.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {memories.length} {memories.length === 1 ? "memory" : "memories"}
          </p>
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {memories.map((m) => (
              <li key={m.id}>
                <MemoryLensCard memory={m} onDeleted={handleDeleted} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isEmpty && (
        <button
          type="button"
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          Refresh list
        </button>
      )}
    </div>
  );
}
