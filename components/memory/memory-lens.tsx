"use client";

import type { SearchResult } from "mem0ai/oss";
import type { MemoryLensProps, SortOption } from "@/types/memory-lens";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MemoryLensContent } from "./MemoryLensContent";
import { clearMemoryLensOverviewClientCache } from "./MemoryLensPageOverview";

import { getCurrentUserMemories, getCurrentUserMemoriesBySearch } from "@/lib/memory/operations";
import { sortMemories } from "@/lib/memory/sort-memories";
import { MEMORY_LENS_PAGE_SIZE_OPTIONS } from "@/types/memory-lens";

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_LIMIT = 100;

export type { SortOption } from "@/types/memory-lens";
export type { MemoryLensProps };

export function MemoryLens({
  variant = "inline",
  className,
  searchQuery,
  searchLimit = 5,
  hideHeading = false,
  paginate = false,
  showPageOverview = false,
}: MemoryLensProps) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recently-added");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const requestVersion = useRef(0);
  const deletedIds = useRef(new Set<string>());

  const effectiveQuery = searchQuery !== undefined ? searchQuery : debouncedSearch.trim() || null;
  const hasSearch = effectiveQuery !== null && effectiveQuery.length > 0;

  const load = useCallback(async () => {
    const version = ++requestVersion.current;

    setLoading(true);
    setError(null);
    try {
      const res = hasSearch
        ? await getCurrentUserMemoriesBySearch(
            effectiveQuery!,
            searchQuery !== undefined ? searchLimit : SEARCH_LIMIT
          )
        : await getCurrentUserMemories();

      if (version !== requestVersion.current) return;
      if (!res || typeof res !== "object") {
        setError("Memory service may be unavailable.");
        setResult(null);
      } else if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        if (showPageOverview) {
          clearMemoryLensOverviewClientCache();
        }
        setResult(
          res.data
            ? {
                ...res.data,
                results: res.data.results.filter((memory) => !deletedIds.current.has(memory.id)),
              }
            : null
        );
      }
    } catch {
      if (version !== requestVersion.current) return;
      setError("Memory service may be unavailable.");
      setResult(null);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [hasSearch, effectiveQuery, searchQuery, searchLimit, showPageOverview]);

  useEffect(() => {
    if (searchQuery !== undefined) return;
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [searchQuery, searchInput]);

  useEffect(() => {
    void load();

    // Server actions cannot be aborted; invalidate their results on query change/unmount.
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  useEffect(() => {
    setPageIndex(0);
  }, [effectiveQuery, sortBy]);

  const handleDeleted = useCallback(
    (id: string) => {
      // An in-flight refresh may still include a memory whose deletion just succeeded.
      deletedIds.current.add(id);
      if (showPageOverview) {
        clearMemoryLensOverviewClientCache();
      }
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
    [showPageOverview]
  );

  const memories = result?.results ?? [];
  const sortedMemories = useMemo(() => sortMemories(memories, sortBy), [memories, sortBy]);
  const isEmpty = sortedMemories.length === 0;
  const showSearchBar = searchQuery === undefined;
  const searchLimitDisplay = searchQuery !== undefined ? searchLimit : SEARCH_LIMIT;

  const maxPageIndex = useMemo(() => {
    if (sortedMemories.length === 0) return 0;

    return Math.max(0, Math.ceil(sortedMemories.length / pageSize) - 1);
  }, [sortedMemories.length, pageSize]);

  useEffect(() => {
    setPageIndex((i) => Math.min(i, maxPageIndex));
  }, [maxPageIndex]);

  const displayMemories = useMemo(() => {
    if (!paginate) return sortedMemories;

    return sortedMemories.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [paginate, sortedMemories, pageIndex, pageSize]);

  const listStartIndex = paginate ? pageIndex * pageSize : 0;

  const paginationProps = paginate
    ? {
        pageIndex,
        pageSize,
        pageSizeOptions: MEMORY_LENS_PAGE_SIZE_OPTIONS,
        totalSortedCount: sortedMemories.length,
        onPageIndexChange: setPageIndex,
        onPageSizeChange: (size: number) => {
          setPageSize(size);
          setPageIndex(0);
        },
      }
    : undefined;

  const isInitialLoad = loading && result === null && error === null;

  return (
    <MemoryLensContent
      className={className}
      displayMemories={displayMemories}
      effectiveQuery={effectiveQuery}
      error={error}
      handleDeleted={handleDeleted}
      hasSearch={hasSearch}
      hideHeading={hideHeading}
      isEmpty={isEmpty}
      isInitialLoad={isInitialLoad}
      isRefreshing={loading && !isInitialLoad}
      listStartIndex={listStartIndex}
      pagination={paginationProps}
      searchInput={searchInput}
      searchLimitDisplay={searchLimitDisplay}
      setSearchInput={setSearchInput}
      setSortBy={setSortBy}
      showPageOverview={showPageOverview}
      showSearchBar={showSearchBar}
      sortBy={sortBy}
      totalSortedCount={sortedMemories.length}
      variant={variant}
      onRefresh={load}
    />
  );
}
