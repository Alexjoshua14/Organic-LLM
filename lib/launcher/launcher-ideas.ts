import type { ThreadLink } from "@/types";

import { getSessionExperience, SESSION_EXPERIENCES } from "@/lib/sidebar/session-experience";

/**
 * Pure logic for the ⌘K launcher's idea cards: which threads show, in what order, how many fit
 * without scrolling, and where arrow keys move focus. No React, no network, no storage, so all
 * of it is testable without a DOM.
 */

/** One recent thread, ready to render as a card. */
export type LauncherIdea = {
  id: string;
  title: string;
  href: string;
  feature: string | undefined;
  /** ISO timestamp from the thread list. */
  date: string;
  /** "Where you left off" — the thread summary when the cue cache has it, else null. */
  cue: string | null;
};

export function buildLauncherIdeas(input: {
  threads: readonly ThreadLink[];
  /** Thread id → resume cue, from the in-memory cue cache. */
  cueById: ReadonlyMap<string, string>;
  /** The thread on screen. A switcher never offers where you already are. */
  activeThreadId: string | null;
}): LauncherIdea[] {
  const seen = new Set<string>();
  const ideas: LauncherIdea[] = [];

  for (const thread of input.threads) {
    if (seen.has(thread.id) || thread.id === input.activeThreadId) continue;
    seen.add(thread.id);
    ideas.push({
      id: thread.id,
      title: thread.title?.trim() ? thread.title : "Untitled chat",
      href: thread.href ?? `/chat/${thread.id}`,
      feature: thread.feature,
      date: thread.date,
      cue: input.cueById.get(thread.id) ?? null,
    });
  }

  // Recency, not pin order: this is a switcher, so the idea you touched last comes first.
  // Array.prototype.sort is stable, so equal or unparseable dates keep the list's order.
  return ideas.sort((a, b) => timeOf(b.date) - timeOf(a.date));
}

function timeOf(date: string): number {
  const ms = Date.parse(date);

  return Number.isFinite(ms) ? ms : 0;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Higher is a better match; 0 means the token is not found. */
function scoreToken(token: string, idea: LauncherIdea, extra: string): number {
  const title = normalize(idea.title);

  if (title.startsWith(token)) return 4;
  if (title.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(token))) return 3;
  if (title.includes(token)) return 2;
  if (extra.includes(token)) return 1;

  return 0;
}

/**
 * Filters and orders ideas for a query. Every word must be found (in the title, the resume cue,
 * or the experience name); better title matches rank first and recency breaks ties. An empty
 * query is just the most recent ideas.
 */
export function rankLauncherIdeas(
  ideas: readonly LauncherIdea[],
  query: string,
  limit: number
): LauncherIdea[] {
  const tokens = normalize(query).split(/\s+/u).filter(Boolean);

  if (tokens.length === 0) return ideas.slice(0, limit);

  const scored: { idea: LauncherIdea; score: number; order: number }[] = [];

  ideas.forEach((idea, order) => {
    const extra = normalize(
      `${idea.cue ?? ""} ${SESSION_EXPERIENCES[getSessionExperience(idea.feature)].label}`
    );
    let total = 0;

    for (const token of tokens) {
      const score = scoreToken(token, idea, extra);

      if (score === 0) return;
      total += score;
    }
    scored.push({ idea, score: total, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.idea);
}

/**
 * Opens an idea exactly the way a sidebar click does: select the thread, then push its canonical
 * path. Nothing is preloaded into the page, so a thread that is still streaming is reattached by
 * the same server-authoritative resume path (docs/thread-session-architecture.md §6) as any other
 * navigation. Keep it that way: the launcher must never hand a page cached thread content.
 */
export function openLauncherIdea(
  idea: Pick<LauncherIdea, "id" | "href">,
  actions: { setChatId: (id: string) => void; push: (href: string) => void; close: () => void }
): void {
  actions.setChatId(idea.id);
  actions.close();
  actions.push(idea.href);
}

/** How many cards fit, and how many per row, without ever scrolling. */
export type LauncherIdeaLayout = { limit: number; columns: number };

/** Tailwind `sm` and `lg`. */
const SM_PX = 640;
const LG_PX = 1024;

export function launcherIdeaLayout(viewportWidth: number): LauncherIdeaLayout {
  if (viewportWidth >= LG_PX) return { limit: 5, columns: 5 };
  if (viewportWidth >= SM_PX) return { limit: 4, columns: 4 };

  // A phone gets a 2×2 grid rather than a row it would have to scroll.
  return { limit: 4, columns: 2 };
}

export type IdeaFocusMove = { kind: "index"; index: number } | { kind: "input" } | { kind: "stay" };

/** Where an arrow key sends focus in the card grid. Up from the first row returns to the input. */
export function moveIdeaFocus(input: {
  index: number;
  count: number;
  columns: number;
  key: string;
}): IdeaFocusMove {
  const { index, count, columns, key } = input;

  if (count <= 0) return { kind: "input" };

  switch (key) {
    case "ArrowLeft":
      return index > 0 ? { kind: "index", index: index - 1 } : { kind: "stay" };
    case "ArrowRight":
      return index < count - 1 ? { kind: "index", index: index + 1 } : { kind: "stay" };
    case "ArrowUp":
      return index - columns >= 0 ? { kind: "index", index: index - columns } : { kind: "input" };
    case "ArrowDown": {
      if (index + columns < count) return { kind: "index", index: index + columns };

      // A short last row: land on its last card rather than stalling.
      const lastRowStart = Math.floor((count - 1) / columns) * columns;

      return index < lastRowStart ? { kind: "index", index: count - 1 } : { kind: "stay" };
    }
    case "Home":
      return { kind: "index", index: 0 };
    case "End":
      return { kind: "index", index: count - 1 };
    default:
      return { kind: "stay" };
  }
}

/** Compact "2h" style age for a card footer; empty when the date is unusable. */
export function formatIdeaAge(date: string, now: number): string {
  const ms = Date.parse(date);

  if (!Number.isFinite(ms)) return "";

  const minutes = Math.max(0, Math.floor((now - ms) / 60_000));

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;

  return `${Math.floor(days / 30)}mo`;
}
