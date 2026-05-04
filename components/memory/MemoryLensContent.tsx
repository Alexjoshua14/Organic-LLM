"use client";

import type { MemoryLensContentProps, SortOption } from "@/types/memory-lens";

import { Suspense, useState } from "react";
import { Switch } from "@heroui/switch";

import { MemoryLensCard } from "./memory-lens-card";
import { MemoryLensOverviewSkeleton } from "./MemoryLensOverviewSkeleton";
import { MemoryLensPageOverview } from "./MemoryLensPageOverview";

import { glass, caption } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";

export function MemoryLensContent({
  variant,
  className,
  hideHeading = false,
  searchInput,
  setSearchInput,
  sortBy,
  setSortBy,
  hasSearch,
  showSearchBar,
  searchLimitDisplay,
  effectiveQuery,
  totalSortedCount,
  displayMemories,
  isEmpty,
  error,
  handleDeleted,
  onRefresh,
  isInitialLoad = false,
  isRefreshing = false,
  pagination,
  listStartIndex = 0,
  showPageOverview = false,
}: MemoryLensContentProps) {
  const [overviewEnabled, setOverviewEnabled] = useState(false);

  const showOverviewUi = Boolean(showPageOverview && !isInitialLoad);
  const totalPages =
    pagination && pagination.totalSortedCount > 0
      ? Math.max(1, Math.ceil(pagination.totalSortedCount / pagination.pageSize))
      : 1;
  const rangeStart =
    pagination && pagination.totalSortedCount > 0
      ? pagination.pageIndex * pagination.pageSize + 1
      : 0;
  const rangeEnd =
    pagination && pagination.totalSortedCount > 0
      ? Math.min(
          pagination.totalSortedCount,
          pagination.pageIndex * pagination.pageSize + pagination.pageSize
        )
      : 0;

  return (
    <section
      aria-describedby="memory-lens-description"
      aria-labelledby={hideHeading ? undefined : "memory-lens-heading"}
      className={cn(
        glass(),
        "rounded-2xl p-5 flex flex-col gap-5",
        variant === "sheet" && "px-2 pb-6",
        variant === "inline" && "px-2 w-full",
        className
      )}
    >
      <header className="space-y-1">
        {!hideHeading && (
          <div>
            <h2 className="text-xl font-semibold text-foreground" id="memory-lens-heading">
              Persisted memory
            </h2>
            <p className={caption({ className: "max-w-md" })} id="memory-lens-description">
              What Organic LLM has stored and can retrieve across any thread. Semantically
              searchable so the right context surfaces when you need it.
            </p>
          </div>
        )}
        {showSearchBar ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-2 pt-2 items-start">
            <div className="flex flex-col gap-1 min-w-0">
              <div
                className={cn(
                  glass(),
                  "overflow-hidden rounded-xl",
                  variant === "inline" ? "max-w-xl" : "max-w-sm"
                )}
              >
                <Input
                  aria-describedby="memory-lens-search-hint"
                  aria-label="Search memories"
                  className="w-full border-0 shadow-none focus-visible:ring-0 rounded-none bg-transparent px-3 py-2"
                  placeholder="Search memories..."
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <p
                aria-live="polite"
                className="text-xs text-muted-foreground/80 italic min-h-5"
                id="memory-lens-search-hint"
              >
                {hasSearch ? (
                  <>
                    Showing up to {searchLimitDisplay} memories for: “{effectiveQuery}”
                  </>
                ) : (
                  <span aria-hidden="true" className="invisible">
                    Showing up to 0 memories for: “”
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap"
                    id="memory-lens-sort-label"
                  >
                    Sort by
                  </span>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger
                      aria-labelledby="memory-lens-sort-label"
                      className={cn(glass(), "rounded-xl")}
                      size="sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recently-added">Recently added</SelectItem>
                      <SelectItem disabled={!hasSearch} value="relevance">
                        Relevance
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {showOverviewUi && (
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <span
                      className="text-xs text-muted-foreground whitespace-nowrap"
                      id="memory-overview-toggle-label"
                    >
                      Page summary
                    </span>
                    <Switch
                      aria-labelledby="memory-overview-toggle-label"
                      isSelected={overviewEnabled}
                      size="sm"
                      onValueChange={setOverviewEnabled}
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground/80 min-h-5 sm:text-right">
                {!hasSearch ? (
                  <>Enter a search to sort by relevance</>
                ) : (
                  <span aria-hidden="true" className="invisible">
                    Placeholder
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs text-muted-foreground whitespace-nowrap"
                id="memory-lens-sort-label-inline"
              >
                Sort by
              </span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger
                  aria-labelledby="memory-lens-sort-label-inline"
                  className={cn(
                    glass({ opaque: true }),
                    "w-[160px] rounded-xl border-0 shadow-none"
                  )}
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recently-added">Recently added</SelectItem>
                  <SelectItem value="relevance">Relevance</SelectItem>
                </SelectContent>
              </Select>
              {showOverviewUi && (
                <>
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap ml-2"
                    id="memory-overview-toggle-label-inline"
                  >
                    Page summary
                  </span>
                  <Switch
                    aria-labelledby="memory-overview-toggle-label-inline"
                    isSelected={overviewEnabled}
                    size="sm"
                    onValueChange={setOverviewEnabled}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {!isInitialLoad && (!isEmpty || error) && (
        <div className="flex justify-end w-full">
          <button
            aria-label="Refresh memory list"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            type="button"
            onClick={onRefresh}
          >
            Refresh list
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative transition-opacity duration-150",
          isRefreshing && "opacity-70 pointer-events-none"
        )}
      >
        {isRefreshing && (
          <p aria-live="polite" className="text-xs text-muted-foreground mb-2">
            Updating…
          </p>
        )}
        {isInitialLoad ? (
          <div
            aria-busy="true"
            aria-label="Loading memories"
            aria-live="polite"
            className="flex flex-col gap-3"
          >
            <div className="h-4 w-24 rounded bg-muted/50 animate-pulse" />
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
        ) : isEmpty ? (
          <div
            aria-live="polite"
            className={cn(
              "rounded-2xl border border-dashed border-foreground/15 bg-background-tertiary/20 px-6 py-10 text-center space-y-2",
              "text-muted-foreground text-sm"
            )}
            role="status"
          >
            {error ? (
              <>
                <p>No memories found.</p>
                <p className="text-xs text-muted-foreground/80">
                  Memory service may be unavailable. Check your connection and try again.
                </p>
              </>
            ) : (
              <p>
                No memories yet. Chat with memory enabled and the model will add important facts
                here over time.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {totalSortedCount} {totalSortedCount === 1 ? "memory" : "memories"}
              </p>
              {pagination && pagination.totalSortedCount > 0 && (
                <p className="text-xs text-muted-foreground/90">
                  Showing {rangeStart}–{rangeEnd} of {pagination.totalSortedCount}
                </p>
              )}
            </div>

            {showOverviewUi && overviewEnabled && displayMemories.length > 0 && (
              <div className="w-full min-h-[6.25rem] rounded-xl border border-foreground/10 bg-background-tertiary/15 px-3 py-2">
                <Suspense fallback={<MemoryLensOverviewSkeleton />}>
                  <MemoryLensPageOverview memoryIds={displayMemories.map((m) => m.id)} />
                </Suspense>
              </div>
            )}

            <ul aria-label="Memory list" className="flex flex-col gap-3 list-none p-0 m-0">
              {displayMemories.map((m, index) => (
                <li
                  key={m.id}
                  aria-posinset={listStartIndex + index + 1}
                  aria-setsize={totalSortedCount}
                >
                  <MemoryLensCard
                    memory={m}
                    showScore={sortBy === "relevance"}
                    onDeleted={handleDeleted}
                  />
                </li>
              ))}
            </ul>

            {pagination && pagination.totalSortedCount > 0 && (
              <nav
                aria-label="Memory list pagination"
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-foreground/10"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    aria-label="Previous page"
                    disabled={pagination.pageIndex <= 0}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      pagination.onPageIndexChange(Math.max(0, pagination.pageIndex - 1))
                    }
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Page {pagination.pageIndex + 1} of {totalPages}
                  </span>
                  <Button
                    aria-label="Next page"
                    disabled={pagination.pageIndex >= totalPages - 1}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      pagination.onPageIndexChange(
                        Math.min(totalPages - 1, pagination.pageIndex + 1)
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap"
                    id="memory-per-page-label"
                  >
                    Per page
                  </span>
                  <Select
                    value={String(pagination.pageSize)}
                    onValueChange={(v) => pagination.onPageSizeChange(Number(v))}
                  >
                    <SelectTrigger
                      aria-labelledby="memory-per-page-label"
                      className={cn(glass(), "h-8 w-[88px] rounded-xl")}
                      size="sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pagination.pageSizeOptions.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </nav>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
