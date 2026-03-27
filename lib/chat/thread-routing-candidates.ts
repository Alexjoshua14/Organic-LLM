import { Thread } from "@/lib/schemas/chat";

export const RABBIT_HOLE_ROUTE_PREFIX = "rabbit_hole:" as const;

export type HomepageRouteCandidateKind = "thread" | "rabbit_hole";

/** One reopen target for homepage semantic routing (thread or rabbit hole session). */
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

  return candidates.filter(
    (c) => c.kind === "thread" && (c.feature ?? "main") === "main"
  );
}

export function appendDraftQueryParam(href: string, draft: string): string {
  const sep = href.includes("?") ? "&" : "?";

  return `${href}${sep}draft=${encodeURIComponent(draft)}`;
}

export type BuildHomepageCandidatesParams = {
  threads: ThreadListRow[];
  summaryByThreadId: Map<string, string | null>;
  coalescenceMode: boolean;
  rabbitHoleSources: RabbitHoleRoutingSource[];
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

  if (!params.coalescenceMode) {
    return scopedThreads;
  }

  const rhCandidates = params.rabbitHoleSources.map((s) => rabbitHoleToCandidate(s));

  return [...scopedThreads, ...rhCandidates];
}
