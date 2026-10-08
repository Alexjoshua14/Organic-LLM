import "server-only";

import type { loadHomepageRoutingCandidates } from "@/lib/chat/load-homepage-routing-candidates";
import type { HomepageRouteCandidate } from "@/lib/chat/thread-routing-candidates";
import type { getMemoriesOwnershipSnapshotForUser } from "@/lib/memory/operations";
import type { MemoryItemType } from "@/lib/schemas/memory";
import type { ResurfaceKind } from "@/lib/resurface/schema";

import { createLogger } from "@/lib/logger";
import { memoryActivityAt } from "@/lib/memory/recent-memories";

const logger = createLogger("lib/resurface/candidates.ts");

/** One past thought Jev may choose to resurface. */
export type ResurfaceCandidate = {
  /** Stable per source, e.g. `memory:<id>` or the routing key of a thread. */
  key: string;
  kind: ResurfaceKind;
  title: string;
  /** The body Jev reads and the voice is seeded with: memory text, summary, or excerpt. */
  text: string;
  href: string | null;
};

/**
 * Pool caps, newest first per kind. Memories lead because they are the distilled thoughts; the
 * other kinds bring the places those thoughts were worked on. ~56 candidates keeps the Jev prompt
 * near 5k tokens.
 */
export const RESURFACE_POOL_CAPS: Record<ResurfaceKind, number> = {
  memory: 24,
  thread: 16,
  rabbit_hole: 8,
  strata_page: 8,
};

/** Per-candidate body cap, so one long summary cannot crowd out the rest of the pool. */
export const RESURFACE_CANDIDATE_TEXT_MAX_CHARS = 600;

const UNTITLED_THREAD = "Untitled chat";

function capText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();

  return clean.length > RESURFACE_CANDIDATE_TEXT_MAX_CHARS
    ? `${clean.slice(0, RESURFACE_CANDIDATE_TEXT_MAX_CHARS)}…`
    : clean;
}

export function memoryToCandidate(memory: MemoryItemType): ResurfaceCandidate | null {
  const text = capText(memory.memory ?? "");

  if (!text) return null;

  return { key: `memory:${memory.id}`, kind: "memory", title: text, text, href: null };
}

/**
 * A thread with neither a title nor a summary has nothing to resurface. Rabbit holes fall back to
 * their root question and Strata pages to their title, both of which say what they were about.
 */
export function routeCandidateToResurface(
  candidate: HomepageRouteCandidate
): ResurfaceCandidate | null {
  const title = candidate.title.trim();
  const summary = candidate.summaryText?.trim() ?? "";

  if (candidate.kind === "thread" && title === UNTITLED_THREAD && !summary) return null;
  if (!title && !summary) return null;

  return {
    key: candidate.routeKey,
    kind: candidate.kind,
    title: title || summary,
    text: capText(summary || title),
    href: candidate.href,
  };
}

/** Newest memories first, then each routed kind in the order its loader returned (newest first). */
export function buildResurfacePool(parts: {
  memories: MemoryItemType[];
  routed: HomepageRouteCandidate[];
}): ResurfaceCandidate[] {
  const memories = [...parts.memories]
    .sort((a, b) => (memoryActivityAt(b) ?? 0) - (memoryActivityAt(a) ?? 0))
    .map(memoryToCandidate)
    .filter((c): c is ResurfaceCandidate => c !== null)
    .slice(0, RESURFACE_POOL_CAPS.memory);

  const routedByKind = new Map<ResurfaceKind, ResurfaceCandidate[]>();

  for (const routed of parts.routed) {
    const candidate = routeCandidateToResurface(routed);

    if (!candidate) continue;

    const list = routedByKind.get(candidate.kind) ?? [];

    if (list.length < RESURFACE_POOL_CAPS[candidate.kind]) list.push(candidate);
    routedByKind.set(candidate.kind, list);
  }

  return [
    ...memories,
    ...(routedByKind.get("thread") ?? []),
    ...(routedByKind.get("rabbit_hole") ?? []),
    ...(routedByKind.get("strata_page") ?? []),
  ];
}

/**
 * Where the pool comes from. The route passes the real loaders; they are parameters rather than
 * imports so this module never pulls in `chat-store`, a "use server" file Bun cannot load in tests.
 */
export type ResurfaceSources = {
  getMemories: typeof getMemoriesOwnershipSnapshotForUser;
  loadRouted: typeof loadHomepageRoutingCandidates;
};

/**
 * Gathers the pool for one owner. Either source failing leaves the other; the homepage would
 * rather show three chats than nothing because Mem0 was slow.
 *
 * The routed loader resolves the owner from the request's Clerk session, so this must run inside
 * the authenticated route that resolved `ownerId`.
 */
export async function collectResurfaceCandidates(
  ownerId: string,
  { getMemories, loadRouted }: ResurfaceSources
): Promise<ResurfaceCandidate[]> {
  const [memoriesRes, routedRes] = await Promise.allSettled([
    getMemories(ownerId),
    // Coalescence on: every thread feature plus rabbit holes, the widest view of past work.
    loadRouted(true),
  ]);

  let memories: MemoryItemType[] = [];
  let routed: HomepageRouteCandidate[] = [];

  if (memoriesRes.status === "fulfilled" && memoriesRes.value.data) {
    memories = memoriesRes.value.data.results;
  } else {
    logger.warn("collectResurfaceCandidates", "Memories unavailable; continuing without them");
  }

  if (routedRes.status === "fulfilled" && routedRes.value.data) {
    routed = routedRes.value.data;
  } else {
    logger.warn("collectResurfaceCandidates", "Threads unavailable; continuing without them");
  }

  return buildResurfacePool({ memories, routed });
}
