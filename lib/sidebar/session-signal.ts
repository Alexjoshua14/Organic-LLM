import type { SessionExperience } from "./session-experience";

/**
 * What a sidebar row tells the user about its session, in priority order. Only one signal shows
 * at a time; idle rows show nothing ("lights out"). See docs/design/sidebar-session-signals.md.
 */
export type SessionSignal =
  | { kind: "live" }
  | { kind: "paused" }
  /** `label` overrides the status line for client-side work (e.g. "Generating title"). */
  | { kind: "working"; step: RabbitHoleStep | null; label?: string }
  /** A short, static explanation — e.g. why a title could not be generated. Never animates. */
  | { kind: "notice"; text: string }
  | { kind: "new" }
  | { kind: "idle" };

export type SessionSignalKind = SessionSignal["kind"];

/** Mirrors `GenerationStep` in `lib/schemas/rabbitHoleSchemas.ts`, kept here so clients stay light. */
export type RabbitHoleStep = "sources" | "article" | "branch_suggestions";

export const RABBIT_HOLE_STEPS: readonly RabbitHoleStep[] = [
  "sources",
  "article",
  "branch_suggestions",
];

const RABBIT_HOLE_STEP_LABEL: Record<RabbitHoleStep, string> = {
  sources: "Finding sources",
  article: "Writing article",
  branch_suggestions: "Suggesting branches",
};

/** Server view of one thread's attention state, as returned by `GET /api/chats/activity`. */
export type SidebarThreadActivity = {
  id: string;
  unseen: boolean;
  /** Present while the server is producing content for this thread. */
  working: { step: RabbitHoleStep | null } | null;
};

/** The live Speak call, if any. `null` outside the voice provider. */
export type VoiceSignalInput = {
  threadId: string | null;
  live: boolean;
  paused: boolean;
} | null;

export const IDLE_SIGNAL: SessionSignal = { kind: "idle" };

export function isRabbitHoleStep(value: unknown): value is RabbitHoleStep {
  return typeof value === "string" && (RABBIT_HOLE_STEPS as readonly string[]).includes(value);
}

/**
 * Resolves the one signal a row shows. Priority: live > paused > working > new > idle.
 *
 * - Speak is never "new" — voice is realtime, so the user was there for all of it.
 * - The thread on screen is never "new" — the user is looking at it.
 */
export function deriveSessionSignal(input: {
  threadId: string;
  experience: SessionExperience;
  activity: SidebarThreadActivity | undefined;
  voice: VoiceSignalInput;
  isActive: boolean;
}): SessionSignal {
  const { threadId, experience, activity, voice, isActive } = input;

  if (voice && voice.threadId === threadId) {
    if (voice.live) return { kind: "live" };
    if (voice.paused) return { kind: "paused" };
  }

  if (activity?.working) {
    return { kind: "working", step: experience === "rabbitHole" ? activity.working.step : null };
  }

  if (activity?.unseen && !isActive && experience !== "speak") {
    return { kind: "new" };
  }

  return IDLE_SIGNAL;
}

/**
 * Words for the status line under a row, or `null` when the row has none. Says *what* is
 * happening, not only that something is.
 */
export function sessionSignalStatusText(signal: SessionSignal): string | null {
  switch (signal.kind) {
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "working":
      return signal.label ?? (signal.step ? RABBIT_HOLE_STEP_LABEL[signal.step] : "Responding");
    case "notice":
      return signal.text;
    case "new":
    case "idle":
      return null;
  }
}

/** Full description for assistive tech: experience, then state. */
export function describeSessionSignal(experienceLabel: string, signal: SessionSignal): string {
  if (signal.kind === "new") return `${experienceLabel}, new activity`;

  const status = sessionSignalStatusText(signal);

  return status ? `${experienceLabel}, ${status.toLowerCase()}` : experienceLabel;
}

/** 0-based index of the running step, for the step meter. `-1` when there is no step. */
export function rabbitHoleStepIndex(step: RabbitHoleStep | null): number {
  return step ? RABBIT_HOLE_STEPS.indexOf(step) : -1;
}

export function hasWorkingActivity(activities: readonly SidebarThreadActivity[] | undefined) {
  return Boolean(activities?.some((activity) => activity.working));
}

/** Counts for the list header. Live calls are excluded — the voice bar already owns them. */
export function summarizeSessionSignals(signals: Iterable<SessionSignal>): {
  unseen: number;
  working: number;
} {
  let unseen = 0;
  let working = 0;

  for (const signal of signals) {
    if (signal.kind === "new") unseen += 1;
    if (signal.kind === "working") working += 1;
  }

  return { unseen, working };
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * True when `href` points at the current location: same path, and every query parameter in the
 * href is present with the same value (extra params on the page are fine). This is how routes
 * that carry the thread in the query — `/rabbitholes?sessionId=…` — are recognised.
 */
export function isThreadHrefActive(
  href: string | undefined,
  pathname: string,
  search: URLSearchParams | string
): boolean {
  if (!href) return false;

  let target: URL;

  try {
    target = new URL(href, "http://sidebar.local");
  } catch {
    return false;
  }

  if (trimTrailingSlash(target.pathname) !== trimTrailingSlash(pathname)) return false;

  const current = typeof search === "string" ? new URLSearchParams(search) : search;

  for (const [key, value] of target.searchParams) {
    if (current.get(key) !== value) return false;
  }

  return true;
}

/**
 * The thread on screen. The path-slug id (`useChatId`) wins; otherwise the unique thread whose
 * href matches the location. Several matches (e.g. every Speak thread shares `/speak`) mean the
 * page does not identify one thread, so none is active.
 */
export function resolveActiveThreadId(
  threads: readonly { id: string; href?: string }[],
  location: { chatId: string | null; pathname: string; search: URLSearchParams | string }
): string | null {
  if (location.chatId) return location.chatId;

  let match: string | null = null;

  for (const thread of threads) {
    if (!isThreadHrefActive(thread.href, location.pathname, location.search)) continue;
    if (match !== null) return null;
    match = thread.id;
  }

  return match;
}
