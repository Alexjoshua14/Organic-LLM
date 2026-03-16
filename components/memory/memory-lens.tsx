"use client";

import type { SearchResult } from "mem0ai/oss";
import type { MemoryLensProps, SortOption } from "@/types/memory-lens";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MemoryLensContent } from "./MemoryLensContent";

import { getCurrentUserMemories, getCurrentUserMemoriesBySearch } from "@/lib/memory/operations";
import { sortMemories } from "@/lib/memory/sort-memories";

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
}: MemoryLensProps) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recently-added");

  const effectiveQuery = searchQuery !== undefined ? searchQuery : debouncedSearch.trim() || null;
  const hasSearch = effectiveQuery !== null && effectiveQuery.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = hasSearch
        ? await getCurrentUserMemoriesBySearch(
            effectiveQuery!,
            searchQuery !== undefined ? searchLimit : SEARCH_LIMIT
          )
        : await getCurrentUserMemories();

      if (!res || typeof res !== "object") {
        setError("Memory service may be unavailable.");
        setResult(null);
      } else if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res.data ?? null);
      }
    } catch {
      setError("Memory service may be unavailable.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [hasSearch, effectiveQuery, searchQuery, searchLimit]);

  useEffect(() => {
    if (searchQuery !== undefined) {
      load();

      return;
    }
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [searchQuery, searchInput, load]);

  useEffect(() => {
    if (searchQuery === undefined) {
      load();
    }
  }, [debouncedSearch, searchQuery, load]);

  const handleDeleted = useCallback((id: string) => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            results: prev.results?.filter((m) => m.id !== id) ?? [],
            relations: prev.relations ?? [],
          }
        : null
    );
  }, []);

  const memories = result?.results ?? [];
  const sortedMemories = useMemo(() => sortMemories(memories, sortBy), [memories, sortBy]);
  const isEmpty = sortedMemories.length === 0;
  const showSearchBar = searchQuery === undefined;
  const searchLimitDisplay = searchQuery !== undefined ? searchLimit : SEARCH_LIMIT;

  const isInitialLoad = loading && result === null && error === null;

  return (
    <MemoryLensContent
      className={className}
      effectiveQuery={effectiveQuery}
      error={error}
      handleDeleted={handleDeleted}
      hasSearch={hasSearch}
      hideHeading={hideHeading}
      isEmpty={isEmpty}
      isInitialLoad={isInitialLoad}
      isRefreshing={loading && !isInitialLoad}
      searchInput={searchInput}
      searchLimitDisplay={searchLimitDisplay}
      setSearchInput={setSearchInput}
      setSortBy={setSortBy}
      showSearchBar={showSearchBar}
      sortBy={sortBy}
      sortedMemories={sortedMemories}
      variant={variant}
      onRefresh={load}
    />
  );
}
