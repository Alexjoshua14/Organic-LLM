import type { MemoryItem } from "mem0ai/oss";

export type SortOption = "recently-added" | "relevance";

export type MemoryLensProps = {
  /** Inline mode (e.g. Settings tab) vs sheet (narrower, with padding) */
  variant?: "inline" | "sheet";
  className?: string;
  /** When set, show only memories matching this semantic query (e.g. for sandbox demo). */
  searchQuery?: string;
  /** Max number of memories when using searchQuery; default 5. */
  searchLimit?: number;
};

export type MemoryLensContentProps = {
  variant: "inline" | "sheet";
  className?: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  hasSearch: boolean;
  showSearchBar: boolean;
  searchLimitDisplay: number;
  effectiveQuery: string | null;
  sortedMemories: MemoryItem[];
  isEmpty: boolean;
  error: string | null;
  handleDeleted: (id: string) => void;
  onRefresh: () => Promise<void>;
  /** True on first load when no data yet; show skeleton in list area only. */
  isInitialLoad?: boolean;
  /** True while a search or refresh is in progress; show subtle loading in list area. */
  isRefreshing?: boolean;
};
