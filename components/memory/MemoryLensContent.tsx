"use client";

import { MemoryLensCard } from "./memory-lens-card";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import type { MemoryLensContentProps, SortOption } from "@/types/memory-lens";

export function MemoryLensContent({
  variant,
  className,
  searchInput,
  setSearchInput,
  sortBy,
  setSortBy,
  hasSearch,
  showSearchBar,
  searchLimitDisplay,
  effectiveQuery,
  sortedMemories,
  isEmpty,
  error,
  handleDeleted,
  onRefresh,
}: MemoryLensContentProps) {
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
        {showSearchBar && (
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:gap-3">
            <Input
              type="search"
              placeholder="Search memories..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-sm"
              aria-label="Search memories"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Sort by
              </span>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
                <SelectTrigger size="sm" className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recently-added">
                    Recently added
                  </SelectItem>
                  <SelectItem
                    value="relevance"
                    disabled={!hasSearch}
                  >
                    Relevance
                  </SelectItem>
                </SelectContent>
              </Select>
              {!hasSearch && (
                <span className="text-[11px] text-muted-foreground/80">
                  Enter a search to sort by relevance
                </span>
              )}
            </div>
          </div>
        )}
        {!showSearchBar && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Sort by
            </span>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger size="sm" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recently-added">
                  Recently added
                </SelectItem>
                <SelectItem value="relevance">Relevance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {hasSearch && (
          <p className="text-xs text-muted-foreground/80 italic">
            Showing up to {searchLimitDisplay} memories for: “{effectiveQuery}”
          </p>
        )}
      </header>

      {isEmpty ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-foreground/15 bg-background-tertiary/20 px-6 py-10 text-center space-y-2",
            "text-muted-foreground text-sm"
          )}
        >
          {error ? (
            <>
              <p>No memories found.</p>
              <p className="text-xs text-muted-foreground/80">
                Memory service may be unavailable. Check your connection and try
                again.
              </p>
            </>
          ) : (
            <p>
              No memories yet. Chat with memory enabled and the model will add
              important facts here over time.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {sortedMemories.length}{" "}
            {sortedMemories.length === 1 ? "memory" : "memories"}
          </p>
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {sortedMemories.map((m) => (
              <li key={m.id}>
                <MemoryLensCard
                  memory={m}
                  onDeleted={handleDeleted}
                  showScore={sortBy === "relevance"}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!isEmpty || error) && (
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          Refresh list
        </button>
      )}
    </div>
  );
}
