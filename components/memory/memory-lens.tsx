"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentUserMemories,
  getCurrentUserMemoriesBySearch,
} from "@/lib/memory/operations";
import type { SearchResult } from "mem0ai/oss";
import { MemoryLensContent } from "./MemoryLensContent";
import { sortMemories } from "@/lib/memory/sort-memories";
import type { MemoryLensProps, SortOption } from "@/types/memory-lens";

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_LIMIT = 100;

export type { SortOption } from "@/types/memory-lens";
export type { MemoryLensProps };

export function MemoryLens({
  variant = "inline",
  className,
  searchQuery,
  searchLimit = 5,
}: MemoryLensProps) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recently-added");

  const effectiveQuery =
    searchQuery !== undefined
      ? searchQuery
      : debouncedSearch.trim() || null;
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
  }, [
    hasSearch,
    effectiveQuery,
    searchQuery,
    searchLimit,
  ]);

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

  const memories = result?.results ?? [];
  const sortedMemories = useMemo(
    () => sortMemories(memories, sortBy),
    [memories, sortBy]
  );
  const isEmpty = sortedMemories.length === 0;
  const showSearchBar = searchQuery === undefined;
  const searchLimitDisplay =
    searchQuery !== undefined ? searchLimit : SEARCH_LIMIT;

  const isInitialLoad = loading && result === null && error === null;

  return (
    <MemoryLensContent
      variant={variant}
      className={className}
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      sortBy={sortBy}
      setSortBy={setSortBy}
      hasSearch={hasSearch}
      showSearchBar={showSearchBar}
      searchLimitDisplay={searchLimitDisplay}
      effectiveQuery={effectiveQuery}
      sortedMemories={sortedMemories}
      isEmpty={isEmpty}
      error={error}
      handleDeleted={handleDeleted}
      onRefresh={load}
      isInitialLoad={isInitialLoad}
      isRefreshing={loading && !isInitialLoad}
    />
  );
}
