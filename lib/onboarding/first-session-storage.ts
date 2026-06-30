import type { FeatureHintId } from "./feature-hints";

export const FIRST_SESSION_STORAGE_KEY = "organic-llm-first-session-checklist";

export type FirstSessionStepId =
  | "start-chat"
  | "explore-noesis"
  | "browse-showcase"
  | "open-rabbit-holes";

export type FirstSessionState = {
  completedSteps: Partial<Record<FirstSessionStepId, true>>;
  dismissedAt?: number;
  version: number;
};

export const FIRST_SESSION_CHECKLIST_VERSION = 1;

export const FIRST_SESSION_STEPS: Array<{
  id: FirstSessionStepId;
  title: string;
  body: string;
  href: string;
  cta: string;
}> = [
  {
    id: "start-chat",
    title: "Start a conversation",
    body: "Open main chat — Search and Memory are on by default.",
    href: "/chat",
    cta: "New chat",
  },
  {
    id: "explore-noesis",
    title: "Try Noesis",
    body: "Topic exploration with sparks and reply suggestions.",
    href: "/sandbox/topic-explore",
    cta: "Open Noesis",
  },
  {
    id: "browse-showcase",
    title: "See one turn unpacked",
    body: "Public scrollytelling — no account required.",
    href: "/showcase/anatomy",
    cta: "Anatomy demo",
  },
  {
    id: "open-rabbit-holes",
    title: "Branch a rabbit hole",
    body: "Research sessions with cited sources you can resume.",
    href: "/rabbitholes/browse",
    cta: "Browse",
  },
];

export function parseFirstSessionState(raw: string | null): FirstSessionState {
  if (!raw) {
    return { completedSteps: {}, version: FIRST_SESSION_CHECKLIST_VERSION };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { completedSteps: {}, version: FIRST_SESSION_CHECKLIST_VERSION };
    }

    const record = parsed as Partial<FirstSessionState>;

    return {
      completedSteps:
        record.completedSteps && typeof record.completedSteps === "object"
          ? (record.completedSteps as FirstSessionState["completedSteps"])
          : {},
      dismissedAt: typeof record.dismissedAt === "number" ? record.dismissedAt : undefined,
      version:
        typeof record.version === "number"
          ? record.version
          : FIRST_SESSION_CHECKLIST_VERSION,
    };
  } catch {
    return { completedSteps: {}, version: FIRST_SESSION_CHECKLIST_VERSION };
  }
}

export function readFirstSessionState(
  storage: Pick<Storage, "getItem"> | null | undefined
): FirstSessionState {
  if (!storage) {
    return { completedSteps: {}, version: FIRST_SESSION_CHECKLIST_VERSION };
  }

  return parseFirstSessionState(storage.getItem(FIRST_SESSION_STORAGE_KEY));
}

export function writeFirstSessionState(
  storage: Pick<Storage, "setItem"> | null | undefined,
  state: FirstSessionState
): void {
  if (!storage) return;

  storage.setItem(FIRST_SESSION_STORAGE_KEY, JSON.stringify(state));
}

export function completeFirstSessionStep(
  storage: Storage | null | undefined,
  stepId: FirstSessionStepId
): FirstSessionState {
  const current = readFirstSessionState(storage);
  const next: FirstSessionState = {
    ...current,
    completedSteps: { ...current.completedSteps, [stepId]: true },
    version: FIRST_SESSION_CHECKLIST_VERSION,
  };

  writeFirstSessionState(storage, next);

  return next;
}

export function dismissFirstSessionChecklist(
  storage: Storage | null | undefined
): FirstSessionState {
  const current = readFirstSessionState(storage);
  const next: FirstSessionState = {
    ...current,
    dismissedAt: Date.now(),
    version: FIRST_SESSION_CHECKLIST_VERSION,
  };

  writeFirstSessionState(storage, next);

  return next;
}

export function isFirstSessionChecklistComplete(state: FirstSessionState): boolean {
  return FIRST_SESSION_STEPS.every((step) => state.completedSteps[step.id]);
}

export function shouldShowFirstSessionChecklist(state: FirstSessionState): boolean {
  if (state.dismissedAt != null) return false;
  if (state.version < FIRST_SESSION_CHECKLIST_VERSION) return true;

  return !isFirstSessionChecklistComplete(state);
}

/** Maps checklist steps to related feature hints for cross-dismiss analytics later. */
export const FIRST_SESSION_HINT_LINKS: Partial<Record<FirstSessionStepId, FeatureHintId>> = {
  "explore-noesis": "noesis-sparks",
  "start-chat": "composer-search-memory",
};
