import type { MemoryItem } from "mem0ai/oss";

export type SortOption = "recently-added" | "relevance";

export const MEMORY_LENS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type MemoryLensPaginationProps = {
  pageIndex: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  totalSortedCount: number;
  onPageIndexChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
};

export type MemoryLensProps = {
  /** Inline mode (e.g. Settings tab) vs sheet (narrower, with padding) */
  variant?: "inline" | "sheet";
  className?: string;
  /** When set, show only memories matching this semantic query (e.g. for sandbox demo). */
  searchQuery?: string;
  /** Max number of memories when using searchQuery; default 5. */
  searchLimit?: number;
  /** When true, do not render the heading (e.g. when parent provides it, as on settings page). */
  hideHeading?: boolean;
  /** When true, paginate the sorted list (Settings memory tab). */
  paginate?: boolean;
  /** When true, show toggle + optional AI overview of the current page (use with paginate on Settings). */
  showPageOverview?: boolean;
};

export type MemoryLensContentProps = {
  variant: "inline" | "sheet";
  className?: string;
  /** When true, do not render the heading; parent provides it (e.g. settings tab). */
  hideHeading?: boolean;
  searchInput: string;
  setSearchInput: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  hasSearch: boolean;
  showSearchBar: boolean;
  searchLimitDisplay: number;
  effectiveQuery: string | null;
  /** Full sorted list length (for counts and global indices). */
  totalSortedCount: number;
  /** Items rendered in the list (full list or current page). */
  displayMemories: MemoryItem[];
  isEmpty: boolean;
  error: string | null;
  handleDeleted: (id: string) => void;
  onRefresh: () => Promise<void>;
  /** True on first load when no data yet; show skeleton in list area only. */
  isInitialLoad?: boolean;
  /** True while a search or refresh is in progress; show subtle loading in list area. */
  isRefreshing?: boolean;
  /** When set, show pagination UI and range line. */
  pagination?: MemoryLensPaginationProps;
  /** 0-based index of the first displayed memory in the full sorted list (for aria-posinset). */
  listStartIndex?: number;
  /** Settings: AI overview of current page (toggle lives in header). */
  showPageOverview?: boolean;
};
