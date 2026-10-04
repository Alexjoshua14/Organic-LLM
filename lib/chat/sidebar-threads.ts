import type { ThreadLink } from "@/types";

import { MEMORY_INGEST_FEATURE } from "@/lib/chat/memory-ingest";

/**
 * Sidebar thread list paging. Shared by GET /api/chats and ChatProvider.
 * See docs/thread-session-architecture.md §4 for the cache contract.
 */

/** Base path; every page key starts with it so `refreshSidebarChats` can find them. */
export const SIDEBAR_CHATS_PATH = "/api/chats";

/** Unpinned rows per page. A tall sidebar shows ~30; one page fills it with headroom. */
export const SIDEBAR_PAGE_SIZE = 50;
export const SIDEBAR_PAGE_SIZE_MAX = 100;

/** Pinned threads come back whole with the first page. Bounds a pathological pin count. */
export const SIDEBAR_PINNED_MAX = 100;

/**
 * `main` lists main chats only. `all` is coalescence mode: every feature except memory
 * ingest, which has its own chamber.
 */
export type SidebarThreadScope = "main" | "all";

export function parseSidebarScope(value: string | null | undefined): SidebarThreadScope {
  return value === "all" ? "all" : "main";
}

/** `threads.feature` is NOT NULL (default `main`), so a plain comparison covers every row. */
export function sidebarFeatureCondition(scope: SidebarThreadScope): {
  op: "eq" | "neq";
  value: string;
} {
  return scope === "all"
    ? { op: "neq", value: MEMORY_INGEST_FEATURE }
    : { op: "eq", value: "main" };
}

/** Row fields the sidebar reads. */
export type SidebarThreadRow = {
  id: string;
  title: string | null;
  owner_id?: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean | null;
  feature?: string | null;
  path?: string | null;
};

export type SidebarThreadsPage = {
  data: SidebarThreadRow[];
  /** First page only. */
  pinned?: SidebarThreadRow[];
  nextCursor: string | null;
};

/**
 * Keyset position: the last row's raw `updated_at` and `id`. The timestamp stays a
 * string; a `Date` round trip drops Postgres microseconds and would skip or repeat rows.
 */
export type SidebarCursor = { updatedAt: string; id: string };

const CURSOR_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const CURSOR_ID = /^[A-Za-z0-9_-]{1,128}$/;

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");

  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

export function encodeSidebarCursor(cursor: SidebarCursor): string {
  return toBase64Url(JSON.stringify([cursor.updatedAt, cursor.id]));
}

/**
 * Strict decode. The values are interpolated into a PostgREST filter, so anything
 * that is not a plain timestamp and id is rejected rather than escaped.
 */
export function decodeSidebarCursor(value: string | null | undefined): SidebarCursor | null {
  if (!value || value.length > 256) return null;

  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value));

    if (!Array.isArray(parsed) || parsed.length !== 2) return null;

    const [updatedAt, id] = parsed;

    if (typeof updatedAt !== "string" || !CURSOR_TIMESTAMP.test(updatedAt)) return null;
    if (typeof id !== "string" || !CURSOR_ID.test(id)) return null;

    return { updatedAt, id };
  } catch {
    return null;
  }
}

/** Rows strictly after the cursor in `updated_at desc, id desc` order. */
export function sidebarCursorFilter(cursor: SidebarCursor): string {
  const at = `"${cursor.updatedAt}"`;

  return `updated_at.lt.${at},and(updated_at.eq.${at},id.lt.${cursor.id})`;
}

export function clampSidebarPageSize(value: string | null | undefined): number {
  const n = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(n) || n < 1) return SIDEBAR_PAGE_SIZE;

  return Math.min(n, SIDEBAR_PAGE_SIZE_MAX);
}

/**
 * Callers fetch `limit + 1` rows. The extra row only signals that another page exists.
 */
export function toSidebarPage(
  rows: SidebarThreadRow[],
  limit: number,
  pinned?: SidebarThreadRow[]
): SidebarThreadsPage {
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? encodeSidebarCursor({ updatedAt: last.updated_at, id: last.id })
      : null;

  return pinned ? { data, pinned, nextCursor } : { data, nextCursor };
}

/** SWR key for page `index`. Returns null once the previous page was the last. */
export function sidebarPageKey(
  scope: SidebarThreadScope,
  index: number,
  previous: SidebarThreadsPage | null
): string | null {
  if (index > 0 && !previous?.nextCursor) return null;

  const params = new URLSearchParams({ scope });

  if (index > 0 && previous?.nextCursor) params.set("cursor", previous.nextCursor);

  return `${SIDEBAR_CHATS_PATH}?${params.toString()}`;
}

/** Accepts the URL or the provider's `[url, userId]` cache key. */
export function isFirstSidebarPageKey(key: unknown): boolean {
  const url = Array.isArray(key) ? key[0] : key;

  return typeof url === "string" && url.startsWith(SIDEBAR_CHATS_PATH) && !url.includes("cursor=");
}

export function toThreadLink(row: SidebarThreadRow): ThreadLink {
  const href = row.path && String(row.path).trim() !== "" ? String(row.path) : `/chat/${row.id}`;

  return {
    title: row.title ?? "Unknown title",
    id: row.id,
    pinned: row.pinned ?? false,
    date: new Date(row.updated_at).toISOString(),
    href,
    feature: row.feature ?? undefined,
    hasNoTitle: row.title == null || String(row.title).trim() === "",
  };
}

/** Newer first. Parsed to ms, then the raw string breaks a same-millisecond tie. */
function compareRowsNewestFirst(a: SidebarThreadRow, b: SidebarThreadRow): number {
  const byTime = Date.parse(b.updated_at) - Date.parse(a.updated_at);

  if (byTime !== 0 && Number.isFinite(byTime)) return byTime;
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;

  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

/**
 * Flatten loaded pages into pinned and unpinned lists, newest first.
 *
 * A thread can appear twice when it moved to the top after an older page was cached;
 * the copy with the latest `updated_at` wins. Rows are split on their own `pinned`
 * flag, so a cache patch that pins or unpins a row moves it between the lists.
 */
export function mergeSidebarPages(pages: SidebarThreadsPage[] | undefined): {
  pinned: SidebarThreadRow[];
  unpinned: SidebarThreadRow[];
} {
  const byId = new Map<string, SidebarThreadRow>();

  for (const page of pages ?? []) {
    for (const row of [...(page.pinned ?? []), ...page.data]) {
      const existing = byId.get(row.id);

      if (!existing || compareRowsNewestFirst(row, existing) < 0) byId.set(row.id, row);
    }
  }

  const rows = [...byId.values()].sort(compareRowsNewestFirst);

  return {
    pinned: rows.filter((row) => row.pinned),
    unpinned: rows.filter((row) => !row.pinned),
  };
}

export type SidebarThreadPatch = Partial<Pick<SidebarThreadRow, "title" | "pinned">>;

/** Apply a known server change to every cached copy of a thread. */
export function patchSidebarPages(
  pages: SidebarThreadsPage[] | undefined,
  id: string,
  patch: SidebarThreadPatch
): SidebarThreadsPage[] | undefined {
  if (!pages) return pages;

  const apply = (rows: SidebarThreadRow[]) =>
    rows.map((row) => (row.id === id ? { ...row, ...patch } : row));

  return pages.map((page) => ({
    ...page,
    data: apply(page.data),
    ...(page.pinned ? { pinned: apply(page.pinned) } : {}),
  }));
}

export function removeFromSidebarPages(
  pages: SidebarThreadsPage[] | undefined,
  id: string
): SidebarThreadsPage[] | undefined {
  if (!pages) return pages;

  const keep = (rows: SidebarThreadRow[]) => rows.filter((row) => row.id !== id);

  return pages.map((page) => ({
    ...page,
    data: keep(page.data),
    ...(page.pinned ? { pinned: keep(page.pinned) } : {}),
  }));
}
