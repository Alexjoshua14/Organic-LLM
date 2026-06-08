import type { StrataRoutingRow } from "@/data/supabase/strata";
import { Thread } from "@/lib/schemas/chat";

export const RABBIT_HOLE_ROUTE_PREFIX = "rabbit_hole:" as const;

/** Internal prefix for Strata page keys (never shown to the routing LLM; index-only contract). */
export const STRATA_PAGE_ROUTE_PREFIX = "strata_page:" as const;

export type HomepageRouteCandidateKind = "thread" | "rabbit_hole" | "strata_page";

/** One reopen target for homepage semantic routing (thread, rabbit hole session, or Strata page). */
export type HomepageRouteCandidate = {
  routeKey: string;
  kind: HomepageRouteCandidateKind;
  title: string;
  feature: string;
  href: string;
  summaryText: string | null;
};

export type ThreadListRow = Thread & { feature?: string | null; path?: string | null };

export function threadHrefFromRow(row: ThreadListRow): string {
  const path = row.path;

  if (path && String(path).trim() !== "") {
    return String(path);
  }

  return `/chat/${row.id}`;
}

/**
 * Maps a thread list row plus optional decrypted summary into a routing candidate.
 */
export function threadRowToCandidate(
  row: ThreadListRow,
  summaryText: string | null
): HomepageRouteCandidate {
  const feature = row.feature ?? "main";

  return {
    routeKey: row.id,
    kind: "thread",
    title: row.title?.trim() ? String(row.title) : "Untitled chat",
    feature,
    href: threadHrefFromRow(row),
    summaryText: summaryText?.trim() ? summaryText : null,
  };
}

export type RabbitHoleRoutingSource = {
  sessionId: string;
  rootQuestion: string;
  rootTitle?: string | null;
  summary?: string | null;
};

export function rabbitHoleToCandidate(source: RabbitHoleRoutingSource): HomepageRouteCandidate {
  const title =
    (source.rootTitle && String(source.rootTitle).trim()) ||
    String(source.rootQuestion || "Rabbit hole").trim();

  return {
    routeKey: `${RABBIT_HOLE_ROUTE_PREFIX}${source.sessionId}`,
    kind: "rabbit_hole",
    title,
    feature: "rabbit_hole",
    href: `/rabbitholes?sessionId=${encodeURIComponent(source.sessionId)}`,
    summaryText: source.summary?.trim() ? String(source.summary) : null,
  };
}

/**
 * Sidebar parity: coalescence off → main chat threads only; coalescence on → keep all thread
 * candidates (any feature) plus rabbit-hole entries are expected to be merged in by the caller.
 */
export function filterThreadCandidatesByCoalescence(
  candidates: HomepageRouteCandidate[],
  coalescenceMode: boolean
): HomepageRouteCandidate[] {
  if (coalescenceMode) {
    return candidates;
  }

  return candidates.filter((c) => c.kind === "thread" && (c.feature ?? "main") === "main");
}

export function appendDraftQueryParam(href: string, draft: string): string {
  const sep = href.includes("?") ? "&" : "?";

  return `${href}${sep}draft=${encodeURIComponent(draft)}`;
}

/** Chat-like destinations accept a composer draft query; Strata pages do not. */
export function shouldAppendDraftForMatchKind(kind: HomepageRouteCandidateKind): boolean {
  return kind === "thread" || kind === "rabbit_hole";
}

export function homepageHrefWithOptionalDraft(
  href: string,
  kind: HomepageRouteCandidateKind,
  draft: string
): string {
  if (!shouldAppendDraftForMatchKind(kind)) return href;

  return appendDraftQueryParam(href, draft);
}

export function strataRoutingRowToCandidate(row: StrataRoutingRow): HomepageRouteCandidate {
  return {
    routeKey: `${STRATA_PAGE_ROUTE_PREFIX}${row.id}`,
    kind: "strata_page",
    title: row.title?.trim() ? String(row.title) : "Untitled Strata page",
    feature: "strata_page",
    href: `/sandbox/prototypes/strata/${row.id}`,
    summaryText: row.excerpt?.trim() ? row.excerpt.trim() : null,
  };
}

/**
 * Resolves a 0-based classifier index into a candidate, or null if out of range / non-integer.
 * Used server-side after `generateObject` and in unit tests.
 */
export function resolveHomepageCandidateByIndex(
  candidates: HomepageRouteCandidate[],
  index: number | null | undefined
): HomepageRouteCandidate | null {
  if (index == null || typeof index !== "number" || !Number.isInteger(index)) return null;
  if (index < 0 || index >= candidates.length) return null;

  return candidates[index] ?? null;
}

export type BuildHomepageCandidatesParams = {
  threads: ThreadListRow[];
  summaryByThreadId: Map<string, string | null>;
  coalescenceMode: boolean;
  rabbitHoleSources: RabbitHoleRoutingSource[];
  /** Recent Strata pages with excerpts; capped and ordered in the loader (see load-homepage-routing-candidates). */
  strataRoutingRows?: StrataRoutingRow[];
};

/**
 * Pure merge of thread list + summaries + optional rabbit holes (for tests and server loader).
 */
export function buildHomepageRoutingCandidatesFromParts(
  params: BuildHomepageCandidatesParams
): HomepageRouteCandidate[] {
  const threadCandidates = params.threads.map((row) =>
    threadRowToCandidate(row, params.summaryByThreadId.get(row.id) ?? null)
  );

  const scopedThreads = filterThreadCandidatesByCoalescence(
    threadCandidates,
    params.coalescenceMode
  );

  const strataCandidates = (params.strataRoutingRows ?? []).map((row) =>
    strataRoutingRowToCandidate(row)
  );

  if (!params.coalescenceMode) {
    return [...scopedThreads, ...strataCandidates];
  }

  const rhCandidates = params.rabbitHoleSources.map((s) => rabbitHoleToCandidate(s));

  return [...scopedThreads, ...rhCandidates, ...strataCandidates];
}
